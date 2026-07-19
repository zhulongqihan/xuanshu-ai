declare module "astronomia/planetposition" {
  export class Planet {
    constructor(data: unknown);
  }
}

declare module "astronomia/data/vsop87Bearth" {
  const earthData: unknown;
  export default earthData;
}

declare module "astronomia/eqtime" {
  import type { Planet } from "astronomia/planetposition";
  export function e(jde: number, earth: Planet): number;
}

declare module "astronomia/solstice" {
  import type { Planet } from "astronomia/planetposition";
  export function longitude(year: number, earth: Planet, longitude: number): number;
}

declare module "astronomia/julian" {
  export class CalendarGregorian {
    constructor(date?: Date);
    fromJDE(jde: number): this;
    toDate(): Date;
    toJDE(): number;
  }
}
