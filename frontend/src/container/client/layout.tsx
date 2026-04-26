import { useGet } from "@/hooks/common/useAPI";
import { UserDetail } from "@/types/user";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/common/useAuth";

const ClientLayOut = () => {
  const { user, isLoading } = useAuth();
  const { data: meData } = useGet<UserDetail>("api/user/me", ["me"], !!user);

  if (isLoading) {
    return (
      <div className="w-full h-[100svh] flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-gray-100 relative">
        <main className="flex w-full h-full flex-col">
          <Outlet context={{ user, meData }} />
        </main>
      </div>
    </>
  );
};
export default ClientLayOut;
