import { GraduationCap, Layout, Mail, Calendar, Library, Map } from 'lucide-react';

const QuickAccessGrid = () => {
  // Array of quick links. We can swap these URLs out later!
  const shortcuts = [
    { name: 'Moodle', icon: GraduationCap, href: '#' },
    { name: 'Nest Portal', icon: Layout, href: '#' },
    { name: 'Student Email', icon: Mail, href: '#' },
    { name: 'Timetable', icon: Calendar, href: '#' },
    { name: 'Library', icon: Library, href: '#' },
    { name: 'Campus Map', icon: Map, href: '#' },
  ];

  return (
    <section className="w-full mb-8">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Links</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {shortcuts.map((shortcut) => (
          <a
            key={shortcut.name}
            href={shortcut.href}
            className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 hover:-translate-y-1 transition-all duration-200 group text-center cursor-pointer"
          >
            {/* Icon Container */}
            <div className="w-12 h-12 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-50 group-hover:text-[#0B4C3A] transition-colors">
              <shortcut.icon size={24} />
            </div>
            
            {/* Title */}
            <span className="text-sm font-semibold text-gray-700 group-hover:text-[#0B4C3A] transition-colors">
              {shortcut.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

export default QuickAccessGrid;