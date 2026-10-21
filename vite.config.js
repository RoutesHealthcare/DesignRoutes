import {defineConfig} from 'vite'
import {viteSingleFile} from 'vite-plugin-singlefile'
import react from '@vitejs/plugin-react'
import {readFileSync} from 'node:fs'
// Vite names the built page after its source file. This renames it on the way out.
function renameHtml(from, to) {
    return {
        name: 'rename-html',
        enforce: 'post',
        generateBundle(options, bundle) {
            bundle[from].fileName = to
        },
    }
}
// The built page is shared on its own, so it carries the licence and the third-party notices with it,
// as a comment at the top. A comment can't contain "--", so those are split up.
function noticesComment(files) {
    return {
        name: 'notices-comment',
        enforce: 'post',
        generateBundle(options, bundle) {
            const text = files
                .map(f => readFileSync(new URL(f, import.meta.url), 'utf8').trim())
                .join('\n\n')
                .replaceAll('--', '- -')
            for (const file of Object.values(bundle)) {
                if (file.fileName.endsWith('.html')) {
                    file.source = file.source.replace(/^<!doctype html>/i, doctype => `${doctype}\n<!--\n${text}\n-->`)
                }
            }
        },
    }
}
export default defineConfig({
    root: 'src',
    plugins: [
        react(),
        viteSingleFile(),
        renameHtml('index.html', 'DesignRoutes-editor.html'),
        noticesComment(['./LICENSE.md', './THIRD-PARTY-NOTICES.md']),
    ],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
})