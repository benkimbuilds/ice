import { Suspense } from "react";
import { SearchFilters } from "@/components/search-filters";
import { IncidentList } from "@/components/incident-list";
import {
  getIncidents,
  getDistinctCountries,
  getTotalWithHeadline,
} from "@/lib/queries";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tags =
    typeof params.tag === "string"
      ? [params.tag]
      : (params.tag as string[] | undefined);

  const page = Number(params.page) || 1;

  const [{ incidents, total, pageSize }, countries, totalAll] =
    await Promise.all([
      getIncidents({
        search: params.q as string,
        tags,
        location: params.location as string,
        country: params.country as string,
        dateFrom: params.from as string,
        dateTo: params.to as string,
        range: params.range as string,
        page,
      }),
      getDistinctCountries(),
      getTotalWithHeadline(),
    ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Suspense fallback={null}>
        <SearchFilters countries={countries} />
      </Suspense>
      <IncidentList
        incidents={incidents}
        total={total}
        totalAll={totalAll}
        page={page}
        totalPages={totalPages}
      />
    </>
  );
}
