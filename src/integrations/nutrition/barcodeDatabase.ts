export interface BarcodeFoodEntry {
  barcode: string;
  name: string;
  servingDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  addedSugarG: number | null;
  totalSugarG: number | null;
  caffeineMg: number | null;
}

/**
 * A tiny starter table of packaged foods keyed by barcode, for a "type/enter a
 * barcode" flow. Camera-based scanning is out of scope for this pass (documented
 * decision: manual digit entry only, to avoid adding a camera/scanning dependency) —
 * this is the lookup table a typed code resolves against. The UI's "save this as a
 * new barcode" action (when a code isn't found) is how this list grows over time,
 * written to a user-editable IndexedDB table, not this static seed file.
 */
export const BARCODE_DATABASE: BarcodeFoodEntry[] = [
  { barcode: "012345678905", name: "Plain Greek Yogurt (5.3oz cup)", servingDescription: "1 cup (150g)", calories: 100, proteinG: 18, carbsG: 6, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 4, caffeineMg: 0 },
  { barcode: "049000028911", name: "Cola (12 fl oz can)", servingDescription: "1 can (355ml)", calories: 140, proteinG: 0, carbsG: 39, fatG: 0, fiberG: 0, addedSugarG: 39, totalSugarG: 39, caffeineMg: 34 },
  { barcode: "016000275287", name: "Rolled Oats (dry, 1/2 cup)", servingDescription: "1/2 cup dry (40g)", calories: 150, proteinG: 5, carbsG: 27, fatG: 3, fiberG: 4, addedSugarG: 0, totalSugarG: 1, caffeineMg: 0 },
  { barcode: "058449428658", name: "Protein Bar (Chocolate Chip Cookie Dough)", servingDescription: "1 bar (60g)", calories: 200, proteinG: 21, carbsG: 21, fatG: 8, fiberG: 14, addedSugarG: 1, totalSugarG: 1, caffeineMg: 0 },
  { barcode: "312843405003", name: "Bottled Iced Coffee (Mocha)", servingDescription: "1 bottle (405ml)", calories: 270, proteinG: 8, carbsG: 50, fatG: 4, fiberG: 0, addedSugarG: 46, totalSugarG: 46, caffeineMg: 90 },
  { barcode: "722252100014", name: "Nut & Seed Bar (Chocolate Sea Salt)", servingDescription: "1 bar (52g)", calories: 210, proteinG: 12, carbsG: 24, fatG: 9, fiberG: 4, addedSugarG: 13, totalSugarG: 13, caffeineMg: 0 },
];
