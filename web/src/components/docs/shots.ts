/** Real screenshots in public/shots: [small width, large width, natural height at the small width]. */
export const SHOTS = {
  SBFMainWindow: [430, 860, 562],
  SFSymbolBrowser: [560, 1119, 599],
  SBFAddFavoriteWindow: [480, 960, 965],
  "svg-import": [420, 840, 595],
  "custom-svg-settings": [420, 840, 714],
  SBFAddFavoriteWithExistingIcon: [504, 1008, 1142],
  SBFAddFavoriteAdvancedSuccess: [480, 960, 1058],
  SBFTaskbarPopOver: [292, 584, 329],
  SBFSettings: [472, 944, 758],
  SBFUpdateNotification: [440, 880, 572],
} as const;
export type ShotName = keyof typeof SHOTS;
