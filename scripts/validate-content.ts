import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import {
  exerciseBaseSchema,
  programSchema,
  testSchema,
  type Program,
} from '../src/content/schemas.ts';
import { blockMinutesTotal, exerciseSlugsOfProgram } from '../src/lib/program.ts';
import { parseFrontmatter } from '../src/lib/frontmatter.ts';

export const RESERVED_PAGE_SLUGS = [
  'program',
  'tests',
  'more',
  'exercises',
  'day',
  'exercise',
] as const;

export interface ValidateInput {
  program: Program;
  exerciseSlugs: Set<string>;
  imageFiles: Set<string>;
  exerciseImages: Map<string, string>;
  testImageFiles?: Set<string>;
  testImages?: Map<string, string>;
  pageSlugs: Set<string>;
}

export function validateContent(input: ValidateInput): string[] {
  const errors: string[] = [];
  const used = new Set(exerciseSlugsOfProgram(input.program));

  for (const slug of used) {
    if (!input.exerciseSlugs.has(slug))
      errors.push(`program references unknown exercise "${slug}"`);
  }
  for (const slug of input.exerciseSlugs) {
    if (!used.has(slug)) errors.push(`unused exercise "${slug}" (not referenced by any day)`);
  }
  for (const [slug, image] of input.exerciseImages) {
    if (!input.imageFiles.has(image))
      errors.push(`exercise "${slug}" points to missing image "${image}"`);
  }
  for (const [id, image] of input.testImages ?? []) {
    if (!input.testImageFiles?.has(image))
      errors.push(`test "${id}" points to missing image "${image}"`);
  }
  for (const day of input.program.days) {
    if (day.blocks.length === 0) continue;
    const total = blockMinutesTotal(day);
    if (Math.abs(total - day.durationMin) > 5) {
      errors.push(
        `${day.weekday}: blocks total ${total} min but durationMin is ${day.durationMin} (duration mismatch)`,
      );
    }
    const starts = new Set<number>();
    for (const block of day.blocks) {
      if (block.minutesTo <= block.minutesFrom)
        errors.push(`${day.weekday}: block "${block.title}" has non-positive length`);
      if (starts.has(block.minutesFrom))
        errors.push(
          `${day.weekday}: block "${block.title}" repeats minutesFrom ${block.minutesFrom} (anchor ids collide)`,
        );
      starts.add(block.minutesFrom);
    }
  }
  for (const slug of input.pageSlugs) {
    if ((RESERVED_PAGE_SLUGS as readonly string[]).includes(slug))
      errors.push(`page slug "${slug}" collides with a reserved route`);
  }
  return errors;
}

const EXERCISE_FILE = /^[a-z0-9-]+\.md$/;

function localeDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function loadFromDisk(root: string): ValidateInput {
  const programText = readFileSync(
    join(root, 'src/content/programs/ru/women-60-plus.yaml'),
    'utf8',
  );
  const program = programSchema.parse(parse(programText));

  const exRoot = join(root, 'src/content/exercises');
  const exerciseSlugs = new Set<string>();
  const exerciseImages = new Map<string, string>();
  for (const lang of localeDirs(exRoot)) {
    const exDir = join(exRoot, lang);
    for (const file of readdirSync(exDir).filter((f) => f.endsWith('.md'))) {
      if (!EXERCISE_FILE.test(file)) {
        throw new Error(`exercise file ${lang}/${file} is not named [a-z0-9-]+.md`);
      }
      const { data } = parseFrontmatter(readFileSync(join(exDir, file), 'utf8'));
      const parsed = exerciseBaseSchema.extend({ image: z.string().min(1) }).parse(data);
      if (parsed.slug !== file.replace(/\.md$/, '')) {
        throw new Error(
          `exercise file ${lang}/${file} has slug "${parsed.slug}" that differs from filename`,
        );
      }
      exerciseSlugs.add(parsed.slug);
      exerciseImages.set(parsed.slug, basename(parsed.image));
    }
  }

  const pagesRoot = join(root, 'src/content/pages');
  const pageSlugs = new Set<string>();
  for (const lang of localeDirs(pagesRoot)) {
    for (const file of readdirSync(join(pagesRoot, lang)).filter((f) => f.endsWith('.md'))) {
      pageSlugs.add(file.replace(/\.md$/, ''));
    }
  }

  const testsRoot = join(root, 'src/content/tests');
  const testImages = new Map<string, string>();
  const testImageFiles = new Set<string>();
  for (const file of readdirSync(testsRoot).filter((f) => f.endsWith('.yaml'))) {
    const doc = z
      .object({ tests: z.array(testSchema.extend({ image: z.string().min(1) })) })
      .parse(parse(readFileSync(join(testsRoot, file), 'utf8')));
    for (const test of doc.tests) {
      const key = `${file.replace(/\.yaml$/, '')}/${test.id}`;
      testImages.set(key, test.image);
      if (existsSync(resolve(testsRoot, test.image))) testImageFiles.add(test.image);
    }
  }

  const imageFiles = new Set(readdirSync(join(root, 'src/assets/exercises')));
  return {
    program,
    exerciseSlugs,
    imageFiles,
    exerciseImages,
    testImages,
    testImageFiles,
    pageSlugs,
  };
}

export function main(): number {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const errors = validateContent(loadFromDisk(root));
  if (errors.length) {
    console.error(`Content validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(` - ${e}`);
    return 1;
  }
  console.log('Content OK');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
