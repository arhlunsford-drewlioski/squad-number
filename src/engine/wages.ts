/** Weekly wage a player of this overall would command. */
export const wageFor = (ovr: number) => Math.round((500 * Math.exp((ovr - 48) * 0.14)) / 50) * 50;
