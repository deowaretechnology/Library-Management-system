import { getSession } from "@/lib/auth/session";
import { listOwnNotifications, markAllNotificationsReadAction } from "@/lib/actions/notifications";
import { StatusBadge } from "@/components/StatusBadge";

export default async function StudentNotificationsPage() {
  const session = await getSession();
  const notifications = await listOwnNotifications(session!.studentId!);
  const unread = notifications.filter((n: any) => !n.read).length;

  return (
    <div className="max-w-lg space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Notifications {unread > 0 && `(${unread} unread)`}</h1>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="studentId" value={session?.studentId} />
            <button className="text-xs text-brand-600 hover:underline">Mark all read</button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nothing yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {(notifications as any[]).map((n) => (
            <li
              key={n._id}
              className={`rounded-lg border p-3 text-sm ${n.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge status={n.type} />
                <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              {n.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
