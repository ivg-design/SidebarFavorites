import type { DocIndexEntry, DocPage, DocGroup } from "./types";
import { DOC_GROUPS, docUrl, plainMeta } from "./types";
import * as quickStart from "./quick-start";
import * as install from "./install";
import * as updates from "./updates";
import * as customSvg from "./custom-svg-icons";
import * as spacers from "./spacers";
import * as cloud from "./cloud-folders";
import * as disks from "./disks-and-shares";
import * as both from "./keeping-both-icons";
import * as popover from "./menu-bar-popover";
import * as how from "./how-it-works";
import * as settings from "./settings";
import * as config from "./config-json";
import * as uninstall from "./uninstalling";
import * as build from "./building-from-source";
import * as nix from "./nix-flake";
import * as trouble from "./troubleshooting";
import * as faq from "./faq";
import * as report from "./report-an-issue";

export { DOC_GROUPS, docUrl };
export type { DocGroup, DocIndexEntry, DocPage };

/** Page order = nav tree order = prev/next order. */
const rawPages: DocPage[] = [
  { ...quickStart.meta, Body: quickStart.Body },
  { ...install.meta, Body: install.Body },
  { ...updates.meta, Body: updates.Body },
  { ...customSvg.meta, Body: customSvg.Body },
  { ...spacers.meta, Body: spacers.Body },
  { ...cloud.meta, Body: cloud.Body },
  { ...disks.meta, Body: disks.Body },
  { ...both.meta, Body: both.Body },
  { ...popover.meta, Body: popover.Body },
  { ...how.meta, Body: how.Body },
  { ...settings.meta, Body: settings.Body },
  { ...config.meta, Body: config.Body },
  { ...uninstall.meta, Body: uninstall.Body },
  { ...build.meta, Body: build.Body },
  { ...nix.meta, Body: nix.Body },
  { ...trouble.meta, Body: trouble.Body },
  { ...faq.meta, Body: faq.Body },
  { ...report.meta, Body: report.Body },
];

export const docPages: DocPage[] = rawPages.map((p) => ({ ...plainMeta(p), Body: p.Body }));

export function getDoc(slug: string): DocPage | undefined {
  return docPages.find((p) => p.slug === slug);
}

/** Serialisable list for the client shell, nav and search palette. */
export const docIndex: DocIndexEntry[] = docPages.map(({ Body: _Body, ...meta }) => {
  void _Body;
  return { ...meta, url: docUrl(meta.slug) };
});

export function neighbours(slug: string): { prev?: DocPage; next?: DocPage } {
  const i = docPages.findIndex((p) => p.slug === slug);
  return { prev: docPages[i - 1], next: docPages[i + 1] };
}
