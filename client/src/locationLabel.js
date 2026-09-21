// A location's real `name` is user-entered and may not be filled in yet, in
// which case this falls back to `scene_heading` -- the set description
// auto-parsed from the script (e.g. "APARTMENT") -- so a dropdown, call
// sheet, etc. show something rather than a blank until the user names it.
export function locationLabel(location) {
  if (!location) return null;
  return location.name || location.scene_heading || null;
}
