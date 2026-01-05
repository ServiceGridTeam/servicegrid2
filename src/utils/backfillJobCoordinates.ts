import { supabase } from "@/integrations/supabase/client";
import { geocodeJobAddress } from "./geocodeJob";

export async function backfillJobCoordinates(onProgress?: (current: number, total: number) => void) {
  // Fetch all jobs with addresses but no coordinates
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, address_line1, city, state, zip")
    .is("latitude", null)
    .not("address_line1", "is", null);

  if (error) {
    console.error("backfillJobCoordinates: Failed to fetch jobs:", error);
    throw error;
  }

  if (!jobs?.length) {
    console.log("backfillJobCoordinates: No jobs need geocoding");
    return { processed: 0, failed: 0, total: 0 };
  }

  console.log(`backfillJobCoordinates: Found ${jobs.length} jobs to geocode`);

  let processed = 0;
  let failed = 0;
  const total = jobs.length;

  for (const job of jobs) {
    const result = await geocodeJobAddress(job.id, job);
    
    if (result) {
      processed++;
    } else {
      failed++;
    }
    
    onProgress?.(processed + failed, total);

    // Rate limit: 200ms between requests to avoid API limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`backfillJobCoordinates: Complete - ${processed} processed, ${failed} failed`);
  return { processed, failed, total };
}

export async function countJobsWithoutCoordinates(): Promise<number> {
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .is("latitude", null)
    .not("address_line1", "is", null);

  if (error) {
    console.error("countJobsWithoutCoordinates: Failed to count:", error);
    return 0;
  }

  return count || 0;
}
