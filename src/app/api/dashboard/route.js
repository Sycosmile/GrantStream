import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const activity =
      await sql`SELECT * FROM activity_feed ORDER BY timestamp DESC LIMIT 20`;
    const grants = await sql`SELECT * FROM grants ORDER BY created_at DESC`;
    const milestones = await sql`SELECT * FROM milestones`;

    // Aggregate stats
    const totalLocked = grants.reduce(
      (acc, g) => acc + Number(g.total_amount),
      0,
    );
    const totalPaid = milestones
      .filter((m) => m.status === "paid")
      .reduce((acc, m) => acc + Number(m.amount), 0);

    return Response.json({
      activity,
      grants,
      stats: {
        totalLocked,
        totalPaid,
        activeGrants: grants.length,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
