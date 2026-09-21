import { getDatabase, modules, lessons } from '@backend/db';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getRagEngine } from '@backend/rag-engine';

async function extractReadableText(filePath: string): Promise<string> {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.pdf') {
        const pdfModule = await import('pdf-parse');
        const pdfParse = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
        return (await pdfParse(await readFile(filePath))).text;
    }
    if (extension === '.md' || extension === '.txt') {
        return readFile(filePath, 'utf8');
    }
    return '';
}

async function ingestReadables(manifest: ContentManifest, contentRoot: string) {
    const engine = getRagEngine();
    if (!engine) return;

    for (const module of manifest.modules) {
        for (const lesson of module.lessons) {
            if (!lesson.readingUrl) continue;
            const filePath = path.resolve(contentRoot, lesson.readingUrl);
            if (!filePath.startsWith(`${path.resolve(contentRoot)}${path.sep}`)) {
                console.warn(`[rag-engine] skipped unsafe readable path: ${lesson.readingUrl}`);
                continue;
            }
            try {
                const text = await extractReadableText(filePath);
                const result = await engine.ingest({
                    id: lesson.id,
                    text,
                    metadata: {
                        title: lesson.title,
                        source: lesson.readingUrl,
                        language: module.language,
                        moduleTitle: module.title,
                    },
                });
                console.log(`[rag-engine] synced ${lesson.id}: ${result.chunkCount} chunks`);
            } catch (error) {
                console.warn(`[rag-engine] failed to ingest ${lesson.readingUrl}:`, error);
            }
        }
    }
}
import type { ContentManifest } from '@backend/content-engine';

/**
 * Sync content manifest to SQLite database
 * This ensures that modules and lessons exist in the DB for foreign key constraints
 */
export async function syncContentToDatabase(manifest: ContentManifest, contentRoot?: string) {
    console.log('🔄 Syncing content to database...');
    const db = getDatabase();

    try {
        await db.transaction(async (tx) => {
            // 1. Sync Modules
            for (const module of manifest.modules) {
                await tx
                    .insert(modules)
                    .values({
                        id: module.id,
                        contentId: module.contentId,
                        version: module.version,
                        hash: module.hash,
                        title: module.title,
                        description: module.description,
                        thumbnailUrl: module.thumbnailUrl,
                        data: JSON.stringify(module), // Store mostly for caching/completeness
                    })
                    .onConflictDoUpdate({
                        target: modules.id,
                        set: {
                            title: module.title,
                            description: module.description,
                            version: module.version,
                            hash: module.hash,
                            data: JSON.stringify(module),
                        },
                    });

                // 2. Sync Lessons for this Module
                for (const lesson of module.lessons) {
                    await tx
                        .insert(lessons)
                        .values({
                            id: lesson.id,
                            contentId: lesson.contentId,
                            version: lesson.version,
                            hash: lesson.hash,
                            moduleId: module.id,
                            title: lesson.title,
                            description: lesson.description,
                            type: lesson.type,
                            videoUrl: lesson.videoUrl, // optional
                            readingUrl: lesson.readingUrl, // optional
                            order: lesson.order,
                            data: JSON.stringify(lesson),
                        })
                        .onConflictDoUpdate({
                            target: lessons.id,
                            set: {
                                title: lesson.title,
                                description: lesson.description,
                                type: lesson.type,
                                videoUrl: lesson.videoUrl,
                                readingUrl: lesson.readingUrl,
                                order: lesson.order,
                                data: JSON.stringify(lesson),
                            },
                        });
                }
            }
        });
        console.log('✅ Content synced to database successfully');
        if (contentRoot) await ingestReadables(manifest, contentRoot);
    } catch (error) {
        console.error('❌ Failed to sync content to database:', error);
        throw error;
    }
}
