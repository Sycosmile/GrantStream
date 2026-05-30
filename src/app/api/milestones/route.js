import sql from "@/app/api/utils/sql";

export async function PATCH(request) {
  try {
    const { milestoneId, status, evidenceUrl } = await request.json();

    const [milestone] = await sql`
      UPDATE milestones
      SET status = ${status}, 
          evidence_url = ${evidenceUrl || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${milestoneId}
      RETURNING *
    `;

    if (status === "approved" || status === "paid") {
      const [grant] =
        await sql`SELECT title FROM grants WHERE id = ${milestone.grant_id}`;
      await sql`
        INSERT INTO activity_feed (message, event_type)
        VALUES (${`Milestone "${milestone.title}" ${status} for ${grant.title}`}, 'milestone_updated')
      `;
    }

    return Response.json(milestone);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update milestone" },
      { status: 500 },
    );
  }
}
