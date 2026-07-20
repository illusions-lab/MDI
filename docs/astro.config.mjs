// @ts-check
import { defineConfig } from 'astro/config';
import astroExpressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';
import remarkMdi from '@illusions-lab/mdi-remark';
import { mdiHandlers } from '@illusions-lab/mdi-to-hast';

/**
 * Rust-backed parser adapter for Astro's remark pipeline. It replaces the
 * historical JavaScript micromark parser, then feeds the resulting mdast
 * through Astro's ordinary rehype phase.
 */

const packages = [
	'mdi',
	'mdast-util-mdi',
	'remark',
	'to-hast',
	'to-html',
	'to-pdf',
	'to-epub',
	'to-docx',
	'cli',
];

const apiPlugins = [];
const apiSidebar = [];
for (const dir of packages) {
	const [plugin, sidebarGroup] = createStarlightTypeDocPlugin();
	apiPlugins.push(
		plugin({
			entryPoints: [`../nodejs/packages/${dir}/src/index.ts`],
			tsconfig: `../nodejs/packages/${dir}/tsconfig.json`,
			output: `api/${dir}`,
			sidebar: { label: dir },
			// Package READMEs are one-line npm stubs; the docs site itself
			// is the long-form documentation, so skip the readme page.
			typeDoc: { readme: 'none' },
		}),
	);
	apiSidebar.push(sidebarGroup);
}

// https://astro.build/config
export default defineConfig({
	site: 'https://mdi.illusions.app',
	markdown: {
		remarkPlugins: [remarkMdi],
		remarkRehype: { handlers: mdiHandlers },
	},
	integrations: [
		astroExpressiveCode(),
		// `remarkMdi` owns the Markdown parser for .md files. MDX needs its
		// standard parser so imports and JSX components remain executable.
		mdx({ extendMarkdownConfig: false }),
		starlight({
			title: 'MDI',
			favicon: '/illusions-kanji.svg',
			description:
				'Rust-authoritative tooling for illusion Markdown (MDI), with thin language bindings and shared renderers.',
			head: [
			{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
			{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
			{
				tag: 'link',
				attrs: {
					rel: 'stylesheet',
					href: 'https://fonts.googleapis.com/css2?family=Zen+Old+Mincho&display=swap',
				},
			},
		],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/illusions-lab/MDI' },
			],
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				ja: { label: '日本語', lang: 'ja' },
				'zh-tw': { label: '正體中文', lang: 'zh-TW' },
			},
			customCss: ['@illusions-lab/mdi-to-hast/mdi.css', './src/styles/docs.css'],
			components: {
				ThemeProvider: './src/components/ForcedDarkTheme.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			plugins: apiPlugins,
			sidebar: [
				{
					label: 'Learn',
					translations: { ja: '学ぶ', 'zh-TW': '學習' },
					items: [
						{ label: 'What is MDI?', translations: { ja: 'MDI とは？', 'zh-TW': '什麼是 MDI？' }, slug: 'learn/what-is-mdi' },
						{ label: 'Core concepts', translations: { ja: 'コア概念', 'zh-TW': '核心概念' }, slug: 'learn/core-concepts' },
						{
							label: 'Getting Started',
							translations: { ja: 'はじめに', 'zh-TW': '快速上手' },
							slug: 'guides/getting-started',
						},
						{ label: 'Full syntax reference', translations: { ja: '完全構文リファレンス', 'zh-TW': '完整語法參考' }, slug: 'syntax/reference' },
					],
				},
				{
					label: 'Core',
					translations: { ja: 'コア', 'zh-TW': '核心' },
					items: [
						{ label: 'Rust-authoritative architecture', translations: { ja: 'Rust 主導アーキテクチャ', 'zh-TW': 'Rust 權威架構' }, slug: 'core/architecture' },
						{ label: 'Document IR', translations: { ja: 'ドキュメント IR', 'zh-TW': '文件 IR' }, slug: 'core/document-ir' },
						{ label: 'Diagnostics and UTF-8 source spans', translations: { ja: '診断と UTF-8 ソーススパン', 'zh-TW': '診斷與 UTF-8 原始碼 span' }, slug: 'core/diagnostics' },
						{ label: 'Rendering model and Chromium/PDF boundary', translations: { ja: 'レンダリングと Chromium/PDF 境界', 'zh-TW': '渲染模型與 Chromium/PDF 邊界' }, slug: 'core/rendering' },
						{ label: 'Rust Core API status', translations: { ja: 'Rust Core API の状態', 'zh-TW': 'Rust Core API 狀態' }, slug: 'core/rust-api' },
					],
				},
				{
					label: 'Bindings',
					translations: { ja: 'バインディング', 'zh-TW': 'Bindings' },
					items: [
						{ label: 'JavaScript / TypeScript', translations: { ja: 'JavaScript / TypeScript', 'zh-TW': 'JavaScript / TypeScript' }, slug: 'bindings/javascript' },
						{ label: 'Android / Kotlin', translations: { ja: 'Android / Kotlin', 'zh-TW': 'Android / Kotlin' }, slug: 'bindings/android' },
						{ label: 'Rust', translations: { ja: 'Rust', 'zh-TW': 'Rust' }, slug: 'bindings/rust' },
						{ label: 'Python', translations: { ja: 'Python', 'zh-TW': 'Python' }, slug: 'bindings/python' },
						{ label: 'Swift', translations: { ja: 'Swift', 'zh-TW': 'Swift' }, slug: 'bindings/swift' },
						{ label: 'CLI', translations: { ja: 'CLI', 'zh-TW': 'CLI' }, slug: 'bindings/cli' },
					],
				},
				{
					label: 'Ecosystem',
					translations: { ja: 'エコシステム', 'zh-TW': '生態系' },
					items: [
						{ label: 'Remark / mdast adapter', translations: { ja: 'Remark / mdast アダプター', 'zh-TW': 'Remark / mdast adapter' }, slug: 'ecosystem/remark' },
						{ label: 'Export profiles', translations: { ja: 'エクスポート・プロファイル', 'zh-TW': '匯出設定檔' }, slug: 'ecosystem/export-profiles' },
						{ label: 'HTML / TXT / EPUB / DOCX / PDF outputs', translations: { ja: 'HTML / TXT / EPUB / DOCX / PDF 出力', 'zh-TW': 'HTML / TXT / EPUB / DOCX / PDF 輸出' }, slug: 'ecosystem/outputs' },
						{ label: 'Migration and compatibility', translations: { ja: '移行と互換性', 'zh-TW': '遷移與相容性' }, slug: 'ecosystem/compatibility' },
					],
				},
				{
					label: 'Syntax',
					translations: { ja: '構文', 'zh-TW': '語法' },
					items: [
						{
							label: 'Live Showcase',
							translations: { ja: 'ライブ・ショーケース', 'zh-TW': '即時渲染展示' },
							slug: 'syntax/showcase',
						},
					],
				},
				{
					label: 'API Reference',
					translations: { ja: 'API リファレンス', 'zh-TW': 'API 參考' },
					items: apiSidebar,
				},
			],
		}),
	],
});
