/* Other ways to write [face=], normalised to the name a mood's faces are keyed by (src/shapes/planning.ts):
   [face=smile] and [face=:)] write and draw the same as [face=happy]. Looked up as typed, then lower-cased, so :D
   and xD keep their case. */
export const FaceAliases: Record<string, string> = {
    smile: 'happy',
    smiley: 'happy',
    ':)': 'happy',
    ':-)': 'happy',
    '🙂': 'happy',
    '😊': 'happy',
    frown: 'sad',
    unhappy: 'sad',
    ':(': 'sad',
    ':-(': 'sad',
    '🙁': 'sad',
    '😞': 'sad',
    cross: 'mad',
    annoyed: 'mad',
    '😒': 'mad',
    furious: 'angry',
    '>:(': 'angry',
    '😠': 'angry',
    '😡': 'angry',
    laugh: 'laughing',
    lol: 'laughing',
    ':D': 'laughing',
    ':-D': 'laughing',
    xD: 'laughing',
    XD: 'laughing',
    '😄': 'laughing',
    '😆': 'laughing',
    '😂': 'laughing',
}

const lower: Record<string, string> = {};
for (const k in FaceAliases) lower[k.toLowerCase()] = FaceAliases[k];

/* face as typed, aliased to the name a mood's faces are keyed by: an exact match first (so :D and xD keep their
   case), then any other casing of the same alias (so Xd still means laughing), then face itself, lower-cased. */
export const resolveFace = (face: string): string => FaceAliases[face] ?? lower[face.toLowerCase()] ?? face.toLowerCase();
