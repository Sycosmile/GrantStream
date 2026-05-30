import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { title, totalAmount, recipientAddress, milestones } =
      await request.json();

    const [grant] = await sql`
      INSERT INTO grants (title, total_amount, recipient_address)
      VALUES (${title}, ${totalAmount}, ${recipientAddress})
      RETURNING *
    `;

    // Insert milestones
    for (const milestone of milestones) {
      await sql`
        INSERT INTO milestones (grant_id, title, amount, status)
        VALUES (${grant.id}, ${milestone.title}, ${milestone.amount}, 'pending')
      `;
    }

    await sql`
      INSERT INTO activity_feed (message, event_type)
      VALUES (${`New grant created: ${title}`}, 'grant_created')
    `;

    return Response.json(grant);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create grant" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const grants = await sql`
      SELECT g.*, 
             (SELECT json_agg(m) FROM milestones m WHERE m.grant_id = g.id) as milestones
      FROM grants g
      ORDER BY g.created_at DESC
    `;
    return Response.json(grants);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch grants" }, { status: 500 });
  }
}
