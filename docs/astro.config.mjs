// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';
import { mdi } from 'micromark-extension-mdi';
import { mdiFromMarkdown } from 'mdast-util-mdi';
import { mdiHandlers } from '@illusions-lab/mdi-to-hast';

/**
 * Register the MDI syntax extensions with Astro's remark pipeline.
 * Only the parser core is added here — GFM and frontmatter handling
 * (bundled by @illusions-lab/mdi-remark for library consumers) are
 * already provided by Astro itself.
 */
function remarkMdiSyntax() {
	// @ts-expect-error `this` is the unified processor.
	const data = this.data();
	(data.micromarkExtensions ??= []).push(mdi());
	(data.fromMarkdownExtensions ??= []).push(mdiFromMarkdown());
}

const packages = [
	'micromark-extension-mdi',
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
			entryPoints: [`../packages/${dir}/src/index.ts`],
			tsconfig: `../packages/${dir}/tsconfig.json`,
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
	site: 'https://illusions-lab.github.io',
	base: '/mdi-js',
	markdown: {
		remarkPlugins: [remarkMdiSyntax],
		remarkRehype: { handlers: mdiHandlers },
	},
	integrations: [
		starlight({
			title: 'mdi-js',
			favicon: '/illusions-kanji.svg',
			description:
				'Node.js tooling for illusion Markdown (MDI) — parse .mdi and convert to HTML, PDF, EPUB, DOCX.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/illusions-lab/mdi-js' },
			],
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				ja: { label: '日本語', lang: 'ja' },
				'zh-tw': { label: '正體中文', lang: 'zh-TW' },
			},
			customCss: ['@illusions-lab/mdi-to-hast/mdi.css', './src/styles/docs.css'],
			plugins: apiPlugins,
			sidebar: [
				{
					label: 'Guides',
					translations: { ja: 'ガイド', 'zh-TW': '指南' },
					items: [
						{
							label: 'Getting Started',
							translations: { ja: 'はじめに', 'zh-TW': '快速上手' },
							slug: 'guides/getting-started',
						},
						{
							label: 'Architecture',
							translations: { ja: 'アーキテクチャ', 'zh-TW': '架構' },
							slug: 'guides/architecture',
						},
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
