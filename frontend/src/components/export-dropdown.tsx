import { useState, useRef, useEffect } from 'react';
import { IOSButton } from '@/components/ui/ios-button';
import { ChevronDown, X, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface ExportDropdownProps {
  reportType: string;
  onExport: (format: 'pdf' | 'excel') => void;
  isExporting?: boolean;
  className?: string;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  buttonSize?: 'sm' | 'lg' | 'xs' | 'md' | 'xl';
}

export function ExportDropdown({
  reportType,
  onExport,
  isExporting = false,
  className = '',
  buttonVariant = 'primary',
  buttonSize = 'sm'
}: ExportDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExport = (format: 'pdf' | 'excel') => {
    if (isExporting) {
      toast.warning('Export in progress, please wait...');
      return;
    }
    
    setShowMenu(false);
    onExport(format);
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <IOSButton
        onClick={() => setShowMenu(!showMenu)}
        variant={buttonVariant}
        size={buttonSize}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export'}
        {showMenu ? (
          <X className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-1" />
        )}
      </IOSButton>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-ios-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase">Export Report As</p>
          </div>
          
          <button
            onClick={() => handleExport('pdf')}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
          >
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">PDF Document</p>
              <p className="text-xs text-gray-500">Professional branded report</p>
            </div>
          </button>
          
          <button
            onClick={() => handleExport('excel')}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors border-t border-gray-100"
          >
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Excel Spreadsheet</p>
              <p className="text-xs text-gray-500">Editable data with charts</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
