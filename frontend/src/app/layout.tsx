import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/lib/providers";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: {
		default: SITE.name,
		template: `%s — ${SITE.name}`,
	},
	description: SITE.description,
	metadataBase: new URL(SITE.url),
	icons: { icon: SITE.icon },
	openGraph: {
		type: "website",
		siteName: SITE.name,
		locale: "en_US",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			data-scroll-behavior="smooth"
			data-skin={SITE.skin}
		>
			<body className="min-h-screen bg-bg-page text-text-primary font-body antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
