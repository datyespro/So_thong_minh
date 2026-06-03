import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Lora } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sổ Thông Minh",
  description: "AI ghi đơn và công nợ cho cửa hàng vật liệu xây dựng nhỏ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${jetBrainsMono.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  var extensionAttribute = "bis_skin_checked";

  function stripAttributes(root) {
    if (!root) return;

    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute(extensionAttribute)) {
      root.removeAttribute(extensionAttribute);
    }

    if (root.querySelectorAll) {
      root.querySelectorAll("[" + extensionAttribute + "]").forEach(function (node) {
        node.removeAttribute(extensionAttribute);
      });
    }
  }

  stripAttributes(document);
  document.documentElement.classList.remove("mdl-js");

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "attributes" && mutation.attributeName === extensionAttribute) {
        mutation.target.removeAttribute(extensionAttribute);
        return;
      }

      mutation.addedNodes.forEach(stripAttributes);
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: [extensionAttribute],
    childList: true,
    subtree: true
  });
})();
`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
