import { failure, paidUser } from "@/lib/guard";
import {
  chooseBrand,
  getConnection,
  listBrands,
  metricoolConfigured,
  MetricoolError,
  removeConnection,
  saveConnection,
} from "@/lib/metricool";

/** Connection status, and the brands the user can pick from. */
export async function GET() {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  if (!metricoolConfigured()) return Response.json({ configured: false, connected: false });
  try {
    const conn = await getConnection(user.id);
    if (!conn) return Response.json({ configured: true, connected: false });
    const brands = await listBrands(conn.token, conn.mcUserId);
    return Response.json({
      configured: true,
      connected: true,
      mcUserId: conn.mcUserId,
      brand: conn.blogId ? { id: conn.blogId, label: conn.brandLabel } : null,
      brands,
    });
  } catch (err) {
    return failure(err);
  }
}

/** Connect: { mcUserId, token }. Checked against Metricool before it is saved. */
export async function POST(req: Request) {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { mcUserId?: unknown; token?: unknown } | null;
  const mcUserId = String(body?.mcUserId ?? "").trim();
  const token = String(body?.token ?? "").trim();
  if (!/^\d{1,20}$/.test(mcUserId) || !token || token.length > 400) return Response.json({ error: "bad_input" }, { status: 400 });
  try {
    const brands = await listBrands(token, mcUserId);
    await saveConnection(user.id, mcUserId, token);
    if (brands.length === 1) await chooseBrand(user.id, brands[0]);
    return Response.json({ connected: true, brands, brand: brands.length === 1 ? brands[0] : null });
  } catch (err) {
    return failure(err);
  }
}

/** Pick the brand to analyse: { blogId }. */
export async function PUT(req: Request) {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { blogId?: unknown } | null;
  try {
    const conn = await getConnection(user.id);
    if (!conn) throw new MetricoolError("not_connected");
    const brand = (await listBrands(conn.token, conn.mcUserId)).find((b) => b.id === String(body?.blogId ?? ""));
    if (!brand) return Response.json({ error: "bad_input" }, { status: 400 });
    await chooseBrand(user.id, brand);
    return Response.json({ brand });
  } catch (err) {
    return failure(err);
  }
}

/** Disconnect and forget the token. */
export async function DELETE() {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  await removeConnection(user.id);
  return Response.json({ connected: false });
}
