export default function Footer() {
  return (
    <footer className="border-t border-line bg-night px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 text-center text-sm text-muted">
      <p>
        للتواصل مع المطوّر:{" "}
        <a
          href="https://t.me/Sami_Tulaimat"
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="font-semibold text-flame-soft underline underline-offset-4 transition-colors hover:text-flame active:text-flame-deep"
        >
          Sami Tolaimat
        </a>
      </p>
    </footer>
  );
}
