export function AuthIllustration({ register = false }: { register?: boolean }) {
  return (
    <svg
      viewBox="0 0 360 300"
      fill="none"
      aria-hidden="true"
      className="auth-illustration"
    >
      <g
        stroke="#11130c"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="m36 65 5 12 12 5-12 5-5 12-5-12-12-5 12-5ZM310 188l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z"
          fill="#fffef5"
        />
        <path d="m293 32 12-20m8 40 24-9M42 230l-14 12m48 4 6 17" />
        {register ? (
          <>
            <path
              d="M90 292c0-72 25-117 87-119 65-2 100 43 108 119"
              fill="#11130c"
            />
            <path d="M151 167v29c12 16 35 16 48-1v-34" fill="#fffef5" />
            <path
              d="M133 103c-9-35 13-64 48-62 35 2 56 32 46 70l-10 43c-19 38-62 28-76 2Z"
              fill="#fffef5"
            />
            <path
              d="M137 125c-38-45-7-103 36-99 14-20 54-8 53 11 35 22 21 50-2 54l-5-30c-21 19-44 19-65 10l-4 51"
              fill="#11130c"
            />
            <path d="M178 112h1m30-1h1m-12 12 5 9-9 2m-18 13c11 9 22 8 31 0" />
            <rect
              x="123"
              y="211"
              width="111"
              height="86"
              rx="12"
              transform="rotate(-10 123 211)"
              fill="#d4ff53"
            />
            <circle cx="181" cy="246" r="15" fill="#fffef5" />
            <path d="m175 246 5 5 10-12" />
            <path
              d="M96 236c-38 50-13 68 49 61l17-13-28-3 12-10-15-5-18 7m135-36c42 42 24 65-20 59l-13-16 22 1-12-12 9-8 20 15"
              fill="#fffef5"
            />
            <rect
              x="31"
              y="118"
              width="51"
              height="52"
              rx="9"
              transform="rotate(-12 31 118)"
              fill="#fffef5"
            />
            <path d="m49 139 8 8-8 8m19-19-5 21" />
            <rect
              x="276"
              y="76"
              width="53"
              height="53"
              rx="9"
              transform="rotate(9 276 76)"
              fill="#fffef5"
            />
            <path d="M296 90c-15 0-16 17-7 21v7h12v-7c10-5 10-21-5-21Z" />
          </>
        ) : (
          <>
            <rect
              x="105"
              y="25"
              width="133"
              height="155"
              rx="13"
              transform="rotate(-12 105 25)"
              fill="#fffef5"
            />
            <path d="m132 51 70-15m-66 36 84-18m-79 38 83-18m-74 65c19-48 30-18 4-6 20-3 15 18 31-2l21 2" />
            <path
              d="m53 150 62 21 40-11 47 6 43-17 43 62-68 39c-23 18-40 17-60 1l-50-37-43-9Z"
              fill="#fffef5"
            />
            <path d="m153 164-30 30c-6 13 7 24 18 17l27-21 63 47c11 13-4 28-17 18l-45-34m33 42-43-34m26 42-38-30m18 29-37-28" />
            <path d="m38 132 52 20-25 73-53-22Z" fill="#11130c" />
            <path d="m281 133 52-17 24 74-52 18Z" fill="#d4ff53" />
            <path
              d="m91 157 22 8-24 67-21-8m193-77 21-7 25 68-22 8"
              fill="#fffef5"
            />
          </>
        )}
      </g>
    </svg>
  );
}
