/** The colour band for a match rating. */
export const ratingBand = (r: number) => (r >= 8 ? 'b-elite' : r >= 7.2 ? 'b-great' : r >= 6.6 ? 'b-good' : r >= 6 ? 'b-mid' : r >= 5.4 ? 'b-low' : 'b-bad');
