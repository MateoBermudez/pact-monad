import "server-only";
import { pool, query, withTransaction } from "@/lib/server/db";
import { ApiError, conflict, forbidden, notFound, requireRole } from "@/lib/server/http";
import { getListing, requireListing, requireOwnListing } from "@/lib/server/services/listings";
import { loadProviderSummaries } from "@/lib/server/services/profiles";
import { emitWebhook } from "@/lib/server/services/webhooks";
import type { SessionUser } from "@/lib/shared/auth";
import type { ApplicationDto, ApplicationStatus, CreateAgreementParams, ListingStatus, SelectionResultDto } from "@/lib/shared/listings";
import { scoreApplicant } from "@/lib/shared/matching";
import { trimMon } from "@/lib/shared/money";
import type { ApplicationAction, ApplyInput } from "@/lib/shared/schemas";

type ApplicationRow = {
  id: string;
  listing_id: string;
  provider_id: string;
  message: string;
  price_mon: string | null;
  days: number | null;
  status: ApplicationStatus;
  created_at: Date;
};

const SELECT_APPLICATION = `
  select id, listing_id, provider_id, message, price_mon::text as price_mon, days, status, created_at
    from applications`;

export type MyApplicationDto = ApplicationDto & { listingTitle: string; listingStatus: ListingStatus };

async function toDtos(rows: ApplicationRow[]): Promise<ApplicationDto[]> {
  const providers = await loadProviderSummaries([...new Set(rows.map((row) => row.provider_id))]);
  return rows.flatMap((row) => {
    const provider = providers.get(row.provider_id);
    if (!provider) return [];
    return [
      {
        id: row.id,
        listingId: row.listing_id,
        providerId: row.provider_id,
        message: row.message,
        priceMon: row.price_mon === null ? null : trimMon(row.price_mon),
        days: row.days,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        provider,
        match: null,
      },
    ];
  });
}

export async function applyToListing(user: SessionUser, listingId: string, input: ApplyInput): Promise<ApplicationDto> {
  requireRole(user, "provider");
  const listing = await requireListing(pool(), listingId);
  if (listing.client_id === user.id) throw forbidden("No puedes postularte a tu propia solicitud");
  if (listing.status !== "open") throw conflict("La solicitud ya no recibe postulaciones");

  const row = await withTransaction(async (client) => {
    const { rows } = await client.query<ApplicationRow>(
      `insert into applications (listing_id, provider_id, message, price_mon, days)
       values ($1, $2, $3, $4, $5)
       returning id, listing_id, provider_id, message, price_mon::text as price_mon, days, status, created_at`,
      [listingId, user.id, input.message, input.priceMon?.toString() ?? null, input.days ?? null],
    );
    await emitWebhook(client, {
      type: "application.received",
      recipients: [{ userId: listing.client_id, role: "client" }],
      data: { listingId, applicationId: rows[0].id, providerId: user.id, priceMon: input.priceMon?.toString() ?? null },
      dedupe: rows[0].id,
    });
    return rows[0];
  });
  return (await toDtos([row]))[0];
}

// Postulaciones de una solicitud, ordenadas por encaje: calificación, habilidades, experiencia, portafolio y precio.
export async function listApplications(user: SessionUser, listingId: string): Promise<ApplicationDto[]> {
  const listing = await requireOwnListing(pool(), user.id, listingId);
  const rows = await query<ApplicationRow>(`${SELECT_APPLICATION} where listing_id = $1`, [listingId]);
  const dtos = await toDtos(rows);

  const ranked = dtos.map((dto) => ({
    ...dto,
    match: scoreApplicant(
      {
        title: listing.title,
        category: listing.category,
        keywords: listing.keywords,
        budgetMon: listing.budget_mon === null ? null : Number(listing.budget_mon),
      },
      { keywords: dto.provider.keywords, skills: dto.provider.skills },
      {
        providerScore: dto.provider.reputation.providerScore,
        completedAsProvider: dto.provider.reputation.completedAsProvider,
        portfolioCount: dto.provider.portfolioCount,
      },
      dto.priceMon === null ? null : Number(dto.priceMon),
    ),
  }));
  return ranked.sort((a, b) => (b.match?.breakdown.total ?? 0) - (a.match?.breakdown.total ?? 0));
}

export async function listMyApplications(user: SessionUser): Promise<MyApplicationDto[]> {
  const rows = await query<ApplicationRow & { listing_title: string; listing_status: ListingStatus }>(
    `select a.id, a.listing_id, a.provider_id, a.message, a.price_mon::text as price_mon, a.days, a.status, a.created_at,
            l.title as listing_title, l.status as listing_status
       from applications a join listings l on l.id = a.listing_id
      where a.provider_id = $1 order by a.created_at desc`,
    [user.id],
  );
  const dtos = await toDtos(rows);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return dtos.map((dto) => ({
    ...dto,
    listingTitle: byId.get(dto.id)?.listing_title ?? "",
    listingStatus: byId.get(dto.id)?.listing_status ?? "closed",
  }));
}

const MAX_ON_CHAIN_DESCRIPTION_BYTES = 480;

// La descripción viaja al contrato (máx. 500 bytes): título y resumen recortados sin partir un carácter.
function onChainDescription(title: string, description: string | null): string {
  const full = description ? `${title}: ${description}` : title;
  const encoder = new TextEncoder();
  let text = full;
  while (encoder.encode(text).length > MAX_ON_CHAIN_DESCRIPTION_BYTES) text = text.slice(0, -1);
  return text;
}

type ActionOutcome = { application: ApplicationDto; selection: SelectionResultDto | null };

async function setStatus(applicationId: string, from: ApplicationStatus[], to: ApplicationStatus): Promise<void> {
  const updated = await query<{ id: string }>(
    "update applications set status = $2 where id = $1 and status = any($3::text[]) returning id",
    [applicationId, to, from],
  );
  if (updated.length === 0) throw conflict("La postulación ya no admite este cambio");
}

export async function actOnApplication(
  user: SessionUser,
  applicationId: string,
  action: ApplicationAction,
): Promise<ActionOutcome> {
  const [application] = await query<ApplicationRow>(`${SELECT_APPLICATION} where id = $1`, [applicationId]);
  if (!application) throw notFound("Postulación");

  if (action === "withdraw") {
    if (application.provider_id !== user.id) throw forbidden("Esta postulación no es tuya");
    await setStatus(applicationId, ["submitted", "shortlisted"], "withdrawn");
  } else {
    await requireOwnListing(pool(), user.id, application.listing_id);
    if (action === "shortlist") await setStatus(applicationId, ["submitted"], "shortlisted");
    if (action === "reject") {
      await setStatus(applicationId, ["submitted", "shortlisted"], "rejected");
      await emitWebhook(pool(), {
        type: "application.rejected",
        recipients: [{ userId: application.provider_id, role: "provider" }],
        data: { listingId: application.listing_id, applicationId },
        dedupe: applicationId,
      });
    }
    if (action === "select") return select(user, applicationId);
  }

  const [updated] = await query<ApplicationRow>(`${SELECT_APPLICATION} where id = $1`, [applicationId]);
  return { application: (await toDtos([updated]))[0], selection: null };
}

// Elegir proveedor adjudica la solicitud y descarta al resto; después el cliente firma createAgreement con estos parámetros.
async function select(user: SessionUser, applicationId: string): Promise<ActionOutcome> {
  const params = await withTransaction(async (client): Promise<CreateAgreementParams> => {
    const { rows } = await client.query<ApplicationRow>(`${SELECT_APPLICATION} where id = $1 for update`, [applicationId]);
    const application = rows[0];
    if (!application) throw notFound("Postulación");

    await client.query("select 1 from listings where id = $1 for update", [application.listing_id]);
    const listing = await requireOwnListing(client, user.id, application.listing_id);
    if (listing.status !== "open") throw conflict("La solicitud ya tiene un proveedor elegido o está cerrada");
    if (!["submitted", "shortlisted"].includes(application.status)) throw conflict("Esta postulación ya no está disponible");
    if (!listing.rules_hash || listing.deadline_days === null) throw new ApiError(422, "unpublished", "La solicitud no está lista");

    await client.query("update applications set status = 'selected' where id = $1", [applicationId]);
    await emitWebhook(client, {
      type: "application.selected",
      recipients: [{ userId: application.provider_id, role: "provider" }],
      data: { listingId: listing.id, applicationId },
      dedupe: applicationId,
    });
    const { rows: discarded } = await client.query<{ id: string; provider_id: string }>(
      `update applications set status = 'rejected'
        where listing_id = $1 and id <> $2 and status in ('submitted', 'shortlisted')
        returning id, provider_id`,
      [listing.id, applicationId],
    );
    for (const other of discarded) {
      await emitWebhook(client, {
        type: "application.rejected",
        recipients: [{ userId: other.provider_id, role: "provider" }],
        data: { listingId: listing.id, applicationId: other.id },
        dedupe: other.id,
      });
    }
    await client.query("update listings set status = 'awarded', awarded_application_id = $2 where id = $1", [
      listing.id,
      applicationId,
    ]);

    const { rows: providers } = await client.query<{ wallet: string }>("select wallet from users where id = $1", [
      application.provider_id,
    ]);
    const amount = application.price_mon ?? listing.budget_mon;
    if (!amount) throw new ApiError(422, "missing_terms", "La solicitud no tiene monto definido");

    return {
      provider: providers[0].wallet,
      description: onChainDescription(listing.title, listing.description),
      deadlineDays: application.days ?? listing.deadline_days,
      rulesHash: listing.rules_hash,
      amountMon: trimMon(amount),
    };
  });

  const [updated] = await query<ApplicationRow>(`${SELECT_APPLICATION} where id = $1`, [applicationId]);
  const listingId = updated.listing_id;
  return {
    application: (await toDtos([updated]))[0],
    selection: { listing: await getListing(user, listingId), contractCall: params },
  };
}
