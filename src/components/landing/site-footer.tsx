import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-ledgerBorder bg-paperWarm py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div>
          <div className="font-display text-lg font-semibold text-inkDeep">
            Sổ Thông Minh<span className="text-stamp">.</span>
          </div>
          <p className="mt-1 text-sm text-textMute">
            Trợ lý ghi sổ cho cửa hàng vật liệu xây dựng.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-textMute">
          <Link href="/login" className="hover:text-ink">
            Đăng nhập
          </Link>
          <span className="font-mono text-textFaint">© 2026</span>
        </div>
      </div>
    </footer>
  );
}
