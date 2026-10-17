import Image from "next/image";

const ART = {
  register: { src: "/illustrations/auth-registro.svg", width: 1502, height: 1041 },
  login: { src: "/illustrations/auth-login.svg", width: 1140, height: 926 },
} as const;

export function AuthIllustration({ register = false }: { register?: boolean }) {
  const art = register ? ART.register : ART.login;
  return (
    <Image
      unoptimized
      src={art.src}
      alt=""
      aria-hidden="true"
      width={art.width}
      height={art.height}
      priority
      className={register ? "auth-illustration auth-illustration-register" : "auth-illustration"}
    />
  );
}
