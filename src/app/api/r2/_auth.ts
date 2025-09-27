
// app/api/r2/_auth.ts
export async function assertAdmin(req: Request) {
  // TODO: ตรวจ Firebase ID Token / Session จริง ๆ ที่นี่
  const ok = true; // เปลี่ยนเป็นเงื่อนไขจริง
  if (!ok) throw new Response("Forbidden", { status: 403 });
}
export async function assertApplicantOwner(applicationId: string, req: Request) {
  // TODO: ตรวจว่า request.auth.uid เป็น owner ของ applications/{applicationId}
  const ok = true; // เปลี่ยนเป็นเงื่อนไขจริง
  if (!ok) throw new Response("Forbidden", { status: 403 });
}
