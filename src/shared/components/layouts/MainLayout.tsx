import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Outlet } from 'react-router-dom';

export function MainLayout() {
  return (
    <div className="flex h-screen w-full min-w-[1000px] min-h-[600px] bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 h-full relative overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-8 backdrop-blur-md bg-background/50">
          <div className="w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
