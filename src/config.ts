import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Giraak Blog",
	subtitle: "AI / Systems / High-Performance Computing / Reinforcement Learning",
	lang: "zh_CN",
	themeColor: {
		hue: 250,
		fixed: false,
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png?v=2",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true,
		depth: 2,
	},
	favicon: [
		{
			src: "/favicon/favicon-32.png?v=2",
			sizes: "32x32",
		},
		{
			src: "/favicon/favicon-128.png?v=2",
			sizes: "128x128",
		},
		{
			src: "/favicon/favicon-180.png?v=2",
			sizes: "180x180",
		},
		{
			src: "/favicon/favicon-192.png?v=2",
			sizes: "192x192",
		},
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "项目",
			url: "/projects/",
			external: false,
		},
		LinkPreset.About,
		{
			name: "工具",
			url: "/tools/",
			external: false,
		},
		{
			name: "GitHub",
			url: "https://github.com/bailei951",
			external: true,
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/头像.jpg",
	name: "Giraak",
	bio: "AI & Systems learner. Focused on deep learning, reinforcement learning, and high-performance computing systems. I build systems, optimize systems, and study how intelligence emerges from them.",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/bailei951",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};
