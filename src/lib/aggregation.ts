import { applicableFields, fields, type Optional, type Values } from "./forms";
export type GraphUnit = {
  code: string;
  parentCode: string | null;
  scope: string;
};
export type DataSource = {
  unitId: string;
  unit: GraphUnit;
  report: { status: string; values: unknown; optional: unknown } | null;
};
export function aggregateScope<T extends DataSource>(
  sources: T[],
  graph: GraphUnit[],
  includeDrafts = false,
) {
  const eligible = sources.filter(
    (a) => a.report && (includeDrafts || a.report.status === "COMPLETE"),
  );
  const covered = new Set(
    eligible
      .filter((a) => a.unit.scope === "INCLUDES_CHILDREN")
      .map((a) => a.unit.code),
  );
  const byCode = new Map(graph.map((u) => [u.code, u]));
  const scope = sources.filter((a) => {
    const visited = new Set<string>();
    let parent = a.unit.parentCode;
    while (parent && !visited.has(parent)) {
      if (covered.has(parent)) return false;
      visited.add(parent);
      parent = byCode.get(parent)?.parentCode || null;
    }
    return true;
  });
  return {
    scope,
    selected: scope.filter((a) => eligible.includes(a)),
    excluded: eligible.filter((a) => !scope.includes(a)),
  };
}
export function metricSummary<T extends DataSource>(
  kind: string,
  sources: T[],
  graph: GraphUnit[],
  includeDrafts = false,
) {
  const { scope, selected, excluded } = aggregateScope(
    sources,
    graph,
    includeDrafts,
  );
  const metrics = fields
    .filter((f) => kind !== "WEEK" || f.weekly)
    .map((f) => {
      const conditional = kind === "MONTH" && !f.monthly;
      const expected = conditional
        ? scope.filter(
            (a) =>
              a.report &&
              applicableFields(kind, a.report.optional as Optional).some(
                (field) => field.key === f.key,
              ),
          ).length
        : scope.length;
      const values = selected
        .filter((a) =>
          applicableFields(kind, a.report!.optional as Optional).some(
            (field) => field.key === f.key,
          ),
        )
        .map((a) => (a.report!.values as Values)[f.key])
        .filter((v): v is number => typeof v === "number");
      return {
        ...f,
        value: values.length ? values.reduce((s, v) => s + v, 0) : null,
        contributors: values.length,
        expected,
        missing: Math.max(0, expected - values.length),
        conditional,
      };
    });
  return {
    metrics,
    sources: selected.map((a) => a.unitId),
    excluded: excluded.map((a) => a.unit.code),
    expectedSources: scope.length,
  };
}
