import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { PageHeader } from "../components/PageHeader";
import { toIsoDate } from "../../domain/dateUtils";
import {
  foodEntryRepository,
  dailyMetricsRepository,
  customFoodRepository,
  getFoodEntriesForDate,
  getFoodEntriesInRange,
  getMostRecentCycle,
} from "../../storage/repositories";
import type { FoodEntry, ParsedFoodItem } from "../../storage/schemas/nutrition";
import type { CustomFood } from "../../storage/schemas/customFood";
import { parseNutritionText } from "../../integrations/nutrition/nutritionParser";
import {
  getDailyNutritionTotals,
  getOrResolveNutritionTarget,
  getDailyIntakeTotalsInRange,
} from "../../app/services/nutritionService";
import { phaseNameForDateInCycles } from "../../app/services/cycleService";
import { resolvePriorityToday } from "../../domain/dashboard/priorityToday";
import { flagUnusualIntakeDays } from "../../domain/nutrition/sugarCaffeineBaseline";
import { rollingAverage } from "../../domain/weight/trend";

const ACCENT_COLOR = "#ec4899";
const DAY_MS = 86_400_000;

interface ReviewItem {
  base: ParsedFoodItem;
  portion: number;
  current: ParsedFoodItem;
}

type EditableNumberField = "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG";

interface CustomFoodFormState {
  name: string;
  /** Comma-separated in the form, split into an array on save. */
  aliases: string;
  servingDescription: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  addedSugarG: string;
  totalSugarG: string;
  caffeineMg: string;
  confidence: "high" | "medium";
}

const EMPTY_CUSTOM_FOOD_FORM: CustomFoodFormState = {
  name: "",
  aliases: "",
  servingDescription: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  addedSugarG: "",
  totalSugarG: "",
  caffeineMg: "",
  confidence: "medium",
};

function customFoodToFormState(food: CustomFood): CustomFoodFormState {
  return {
    name: food.name,
    aliases: food.aliases.join(", "),
    servingDescription: food.servingDescription,
    calories: String(food.calories),
    proteinG: String(food.proteinG),
    carbsG: String(food.carbsG),
    fatG: String(food.fatG),
    fiberG: String(food.fiberG),
    addedSugarG: food.addedSugarG != null ? String(food.addedSugarG) : "",
    totalSugarG: food.totalSugarG != null ? String(food.totalSugarG) : "",
    caffeineMg: food.caffeineMg != null ? String(food.caffeineMg) : "",
    confidence: food.confidence,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scales every numeric field of a parsed food item by `portion`, proportionally —
 * applied to a fresh copy of the ORIGINAL parse output each time so repeated portion
 * edits don't compound rounding error. */
function scaleParsedFood(base: ParsedFoodItem, portion: number): ParsedFoodItem {
  const scale = (n: number) => round1(n * portion);
  const scaleNullable = (n: number | null) => (n == null ? null : scale(n));
  return {
    ...base,
    calories: scale(base.calories),
    calorieRangeLow: scaleNullable(base.calorieRangeLow),
    calorieRangeHigh: scaleNullable(base.calorieRangeHigh),
    proteinG: scale(base.proteinG),
    carbsG: scaleNullable(base.carbsG),
    fatG: scaleNullable(base.fatG),
    fiberG: scale(base.fiberG),
    addedSugarG: scaleNullable(base.addedSugarG),
    totalSugarG: scaleNullable(base.totalSugarG),
    caffeineMg: scaleNullable(base.caffeineMg),
  };
}

async function getLastFoodEntry(): Promise<FoodEntry | undefined> {
  const today = new Date();
  const start = toIsoDate(new Date(today.getTime() - 14 * DAY_MS));
  const end = toIsoDate(today);
  const entries = await getFoodEntriesInRange(start, end);
  return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

async function getFrequentMeals(): Promise<{ text: string; count: number }[]> {
  const today = new Date();
  const start = toIsoDate(new Date(today.getTime() - 60 * DAY_MS));
  const end = toIsoDate(today);
  const entries = await getFoodEntriesInRange(start, end);

  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.rawText) counts.set(entry.rawText, (counts.get(entry.rawText) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function NutritionScreen() {
  const today = toIsoDate(new Date());

  const [quickAddText, setQuickAddText] = useState("");
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  const [parsedRawText, setParsedRawText] = useState<string | null>(null);

  const [foodFormOpen, setFoodFormOpen] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState<CustomFoodFormState>(EMPTY_CUSTOM_FOOD_FORM);

  const customFoods = useLiveQuery(() => customFoodRepository.getAll(), []);
  const todaysEntries = useLiveQuery(() => getFoodEntriesForDate(today), [today]);
  const lastEntry = useLiveQuery(() => getLastFoodEntry(), [today]);
  const frequentMeals = useLiveQuery(() => getFrequentMeals(), [today]);
  const totals = useLiveQuery(() => getDailyNutritionTotals(today), [today]);
  const target = useLiveQuery(() => getOrResolveNutritionTarget(today), [today]);
  const dailyMetrics = useLiveQuery(() => dailyMetricsRepository.getAll(), []);
  const sugarCaffeineHistory = useLiveQuery(() => {
    const start = toIsoDate(new Date(Date.now() - 21 * DAY_MS));
    return getDailyIntakeTotalsInRange(start, today);
  }, [today]);
  const cyclePhase = useLiveQuery(async () => {
    const cycle = await getMostRecentCycle();
    if (!cycle) return null;
    return phaseNameForDateInCycles(today, [cycle]);
  }, [today]);

  const weightTrend = useMemo(() => {
    if (!dailyMetrics) return [];
    const cutoff = toIsoDate(new Date(Date.now() - 30 * DAY_MS));
    const weights = dailyMetrics
      .filter((m) => m.weightLb != null && m.date >= cutoff)
      .map((m) => ({ date: m.date, weightLb: m.weightLb! }));
    return rollingAverage(weights, 7);
  }, [dailyMetrics]);

  const priorityHeadline = useMemo(() => {
    if (!totals || !target) return null;
    const nutrients: { label: "calories" | "protein" | "fiber" | "carbs" | "fat"; targetAmount: number; consumedAmount: number }[] = [
      { label: "calories", targetAmount: target.calorieTarget, consumedAmount: totals.calories },
      { label: "protein", targetAmount: target.proteinTargetG, consumedAmount: totals.proteinG },
      { label: "fiber", targetAmount: target.fiberTargetG, consumedAmount: totals.fiberG },
    ];
    if (target.carbTargetG != null) {
      nutrients.push({ label: "carbs", targetAmount: target.carbTargetG, consumedAmount: totals.carbsG });
    }
    if (target.fatTargetG != null) {
      nutrients.push({ label: "fat", targetAmount: target.fatTargetG, consumedAmount: totals.fatG });
    }
    return resolvePriorityToday({ nutrients, activityType: "other" }).headline;
  }, [totals, target]);

  const sugarCaffeineFlags = useMemo(() => {
    if (!totals || !sugarCaffeineHistory) return [];
    const todayIntake = {
      date: today,
      addedSugarG: totals.addedSugarG,
      totalSugarG: totals.totalSugarG,
      caffeineMg: totals.caffeineMg,
    };
    return flagUnusualIntakeDays(sugarCaffeineHistory, todayIntake).filter((f) => f.isUnusuallyHigh);
  }, [totals, sugarCaffeineHistory, today]);

  function handleParse() {
    const text = quickAddText.trim();
    if (!text) return;
    const parsed = parseNutritionText(text, customFoods ?? []);
    setReviewItems(parsed.map((item) => ({ base: item, portion: 1, current: item })));
    setParsedRawText(text);
  }

  function handleStartAddFood() {
    setEditingFoodId(null);
    setFoodForm(EMPTY_CUSTOM_FOOD_FORM);
    setFoodFormOpen(true);
  }

  function handleStartEditFood(food: CustomFood) {
    setEditingFoodId(food.id);
    setFoodForm(customFoodToFormState(food));
    setFoodFormOpen(true);
  }

  function handleCancelFoodForm() {
    setFoodFormOpen(false);
    setEditingFoodId(null);
    setFoodForm(EMPTY_CUSTOM_FOOD_FORM);
  }

  async function handleSaveFood() {
    const name = foodForm.name.trim();
    const servingDescription = foodForm.servingDescription.trim();
    const aliases = foodForm.aliases
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.length > 0);
    if (!name || !servingDescription || aliases.length === 0) return;

    const toNumber = (s: string) => (s.trim() === "" ? 0 : Number(s));
    const toNullableNumber = (s: string) => (s.trim() === "" ? null : Number(s));
    const existing = editingFoodId ? customFoods?.find((f) => f.id === editingFoodId) : undefined;

    await customFoodRepository.put({
      id: editingFoodId ?? uuid(),
      name,
      aliases,
      servingDescription,
      calories: toNumber(foodForm.calories),
      proteinG: toNumber(foodForm.proteinG),
      carbsG: toNumber(foodForm.carbsG),
      fatG: toNumber(foodForm.fatG),
      fiberG: toNumber(foodForm.fiberG),
      addedSugarG: toNullableNumber(foodForm.addedSugarG),
      totalSugarG: toNullableNumber(foodForm.totalSugarG),
      caffeineMg: toNullableNumber(foodForm.caffeineMg),
      confidence: foodForm.confidence,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    handleCancelFoodForm();
  }

  async function handleDeleteCustomFood(id: string) {
    await customFoodRepository.delete(id);
  }

  function handleCancelReview() {
    setReviewItems(null);
    setParsedRawText(null);
  }

  function handlePortionChange(index: number, portion: number) {
    setReviewItems((prev) => {
      if (!prev) return prev;
      return prev.map((item, i) =>
        i === index ? { ...item, portion, current: scaleParsedFood(item.base, portion) } : item,
      );
    });
  }

  function handleFieldChange(index: number, field: EditableNumberField, value: number) {
    setReviewItems((prev) => {
      if (!prev) return prev;
      return prev.map((item, i) => (i === index ? { ...item, current: { ...item.current, [field]: value } } : item));
    });
  }

  function handleRemoveReviewItem(index: number) {
    setReviewItems((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleLogReview() {
    if (!reviewItems || reviewItems.length === 0) return;
    const now = new Date();
    await foodEntryRepository.put({
      id: uuid(),
      timestamp: now.toISOString(),
      date: toIsoDate(now),
      rawText: parsedRawText,
      parsedFoods: reviewItems.map((r) => r.current),
      source: "manual",
      notes: null,
    });
    setReviewItems(null);
    setParsedRawText(null);
    setQuickAddText("");
  }

  async function handleSameAsLastTime() {
    if (!lastEntry) return;
    const now = new Date();
    await foodEntryRepository.put({
      id: uuid(),
      timestamp: now.toISOString(),
      date: toIsoDate(now),
      rawText: lastEntry.rawText,
      parsedFoods: lastEntry.parsedFoods,
      source: lastEntry.source,
      notes: null,
    });
  }

  function handleUseFrequentMeal(text: string) {
    setQuickAddText(text);
    setReviewItems(null);
    setParsedRawText(null);
  }

  async function handleDeleteEntry(id: string) {
    await foodEntryRepository.delete(id);
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Nutrition" subtitle="Log meals and track today's targets" />

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Quick add</h2>
        <textarea
          className="w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm text-slate-800 focus:border-accent focus:outline-none dark:border-slate-700 dark:text-slate-100"
          rows={3}
          placeholder="e.g. 2 eggs, oatmeal, coffee with milk"
          value={quickAddText}
          onChange={(e) => setQuickAddText(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            onClick={handleParse}
            disabled={quickAddText.trim().length === 0}
          >
            Parse
          </button>
        </div>

        {reviewItems && (
          <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            {reviewItems.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nothing recognized — try Log this anyway, or rephrase.</p>
            )}
            {reviewItems.map((item, index) => (
              <div key={index} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.current.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {item.current.confidence} confidence
                    </span>
                    <button
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      onClick={() => handleRemoveReviewItem(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  <label className="flex flex-col gap-0.5">
                    Portion
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={item.portion}
                      onChange={(e) => handlePortionChange(index, Number(e.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Calories
                    <input
                      type="number"
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={item.current.calories}
                      onChange={(e) => handleFieldChange(index, "calories", Number(e.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Protein (g)
                    <input
                      type="number"
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={item.current.proteinG}
                      onChange={(e) => handleFieldChange(index, "proteinG", Number(e.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Carbs (g)
                    <input
                      type="number"
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={item.current.carbsG ?? 0}
                      onChange={(e) => handleFieldChange(index, "carbsG", Number(e.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Fat (g)
                    <input
                      type="number"
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={item.current.fatG ?? 0}
                      onChange={(e) => handleFieldChange(index, "fatG", Number(e.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Fiber (g)
                    <input
                      type="number"
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={item.current.fiberG}
                      onChange={(e) => handleFieldChange(index, "fiberG", Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                onClick={handleCancelReview}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                onClick={handleLogReview}
              >
                Log this
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Faster logging</h2>
        <div className="flex flex-col gap-2">
          {lastEntry && (
            <button
              className="self-start rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
              onClick={handleSameAsLastTime}
            >
              Same as last time
            </button>
          )}
          {frequentMeals && frequentMeals.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Frequent meals</p>
              <div className="flex flex-wrap gap-2">
                {frequentMeals.map((meal) => (
                  <button
                    key={meal.text}
                    className="rounded-full bg-accent-muted/30 px-3 py-1 text-xs text-accent dark:bg-slate-800 dark:text-accent-muted"
                    onClick={() => handleUseFrequentMeal(meal.text)}
                    title={meal.text}
                  >
                    {meal.text.length > 28 ? `${meal.text.slice(0, 28)}...` : meal.text} ({meal.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Custom foods</h2>
          {!foodFormOpen && (
            <button
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
              onClick={handleStartAddFood}
            >
              + Add a food
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Add a food the quick-add parser doesn't recognize, or fix one that's wrong — these are checked before the
          built-in list, so an entry here overrides a built-in food with the same name.
        </p>

        {foodFormOpen && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="col-span-2 flex flex-col gap-0.5">
                Name
                <input
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-0.5">
                Aliases (comma-separated words the parser should match, e.g. "ribeye, ribeye steak")
                <input
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.aliases}
                  onChange={(e) => setFoodForm((f) => ({ ...f, aliases: e.target.value }))}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-0.5">
                Serving description (e.g. "1 medium (200g)" or "100g cooked")
                <input
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.servingDescription}
                  onChange={(e) => setFoodForm((f) => ({ ...f, servingDescription: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Calories
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.calories}
                  onChange={(e) => setFoodForm((f) => ({ ...f, calories: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Protein (g)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.proteinG}
                  onChange={(e) => setFoodForm((f) => ({ ...f, proteinG: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Carbs (g)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.carbsG}
                  onChange={(e) => setFoodForm((f) => ({ ...f, carbsG: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Fat (g)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.fatG}
                  onChange={(e) => setFoodForm((f) => ({ ...f, fatG: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Fiber (g)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.fiberG}
                  onChange={(e) => setFoodForm((f) => ({ ...f, fiberG: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Added sugar (g, optional)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.addedSugarG}
                  onChange={(e) => setFoodForm((f) => ({ ...f, addedSugarG: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Total sugar (g, optional)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.totalSugarG}
                  onChange={(e) => setFoodForm((f) => ({ ...f, totalSugarG: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Caffeine (mg, optional)
                <input
                  type="number"
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.caffeineMg}
                  onChange={(e) => setFoodForm((f) => ({ ...f, caffeineMg: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Confidence
                <select
                  className="rounded border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={foodForm.confidence}
                  onChange={(e) => setFoodForm((f) => ({ ...f, confidence: e.target.value as "high" | "medium" }))}
                >
                  <option value="high">High (single ingredient)</option>
                  <option value="medium">Medium (composite/branded)</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                onClick={handleCancelFoodForm}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                onClick={handleSaveFood}
                disabled={
                  foodForm.name.trim().length === 0 ||
                  foodForm.servingDescription.trim().length === 0 ||
                  foodForm.aliases.trim().length === 0
                }
              >
                {editingFoodId ? "Save changes" : "Add food"}
              </button>
            </div>
          </div>
        )}

        {customFoods && customFoods.length > 0 ? (
          <div className="flex flex-col gap-1">
            {customFoods.map((food) => (
              <div
                key={food.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{food.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {food.servingDescription} &middot; {food.calories} kcal
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    className="text-slate-500 hover:text-accent dark:text-slate-400"
                    onClick={() => handleStartEditFood(food)}
                  >
                    Edit
                  </button>
                  <button className="text-slate-400 hover:text-red-500" onClick={() => handleDeleteCustomFood(food.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !foodFormOpen && <p className="text-sm text-slate-500 dark:text-slate-400">No custom foods yet.</p>
        )}
      </Card>

      {totals && target && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Today's progress</h2>
          <div className="flex flex-col gap-3">
            <ProgressBar value={totals.calories} target={target.calorieTarget} label="Calories" unit="kcal" />
            <ProgressBar value={totals.proteinG} target={target.proteinTargetG} label="Protein" unit="g" />
            <ProgressBar value={totals.fiberG} target={target.fiberTargetG} label="Fiber" unit="g" />
            {target.carbTargetG != null && (
              <ProgressBar value={totals.carbsG} target={target.carbTargetG} label="Carbs" unit="g" />
            )}
          </div>
        </Card>
      )}

      {priorityHeadline && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">What should I eat next?</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{priorityHeadline}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Weight trend (30 days)</h2>
        {weightTrend.length > 0 ? (
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={weightTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={false} />
                <YAxis width={40} domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="average" stroke={ACCENT_COLOR} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Not enough weight data yet.</p>
        )}
        {cyclePhase && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current cycle phase: {cyclePhase}</p>
        )}
      </Card>

      {sugarCaffeineFlags.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Sugar &amp; caffeine notice</h2>
          <div className="flex flex-col gap-2">
            {sugarCaffeineFlags.map((flag) => (
              <div key={flag.metric} className="flex items-start justify-between gap-2 text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                  Today's {flag.metric === "caffeineMg" ? "caffeine" : flag.metric === "addedSugarG" ? "added sugar" : "total sugar"} ({Math.round(flag.todayValue)}) is higher than your recent typical day (avg {Math.round(flag.baselineMean)}) — noted for pattern tracking, not a judgment.
                </p>
                <ConfidenceBadge tier={flag.confidence} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Today's food log</h2>
        {todaysEntries && todaysEntries.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todaysEntries.map((entry) => {
              const entryCalories = entry.parsedFoods.reduce((sum, f) => sum + f.calories, 0);
              return (
                <div key={entry.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {entry.parsedFoods.map((f) => f.name).join(", ") || entry.rawText || "(no items)"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round(entryCalories)} kcal total</p>
                    </div>
                    <button
                      className="text-xs text-slate-400 hover:text-red-500"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nothing logged yet today.</p>
        )}
      </Card>
    </div>
  );
}
