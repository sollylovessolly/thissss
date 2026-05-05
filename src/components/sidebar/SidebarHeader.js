export default function SidebarHeader({ user }) {
  return (
    <div className="p-4 flex items-center justify-between border-b border-gray-800">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center font-bold">
          {user?.display_name?.[0]}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{user?.display_name}</h3>
          <p className="text-xs text-green-400">Online</p>
        </div>
      </div>
    </div>
  );
}
