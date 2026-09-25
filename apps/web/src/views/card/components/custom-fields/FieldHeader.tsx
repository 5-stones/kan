import { HiPlus, HiChevronDown, HiChevronRight } from "react-icons/hi2";

interface FieldHeaderProps {
  title: string;
  onToggle?: () => void;
  onAdd?: () => void;
  collapsed?: boolean;
  canEdit?: boolean;
  isSection?: boolean;
}

export function FieldHeader({
  title,
  onToggle,
  onAdd,
  collapsed,
  canEdit = true,
  isSection = false,
}: FieldHeaderProps) {
  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAdd) {
      onAdd();
    } else if (onToggle && collapsed) {
      onToggle();
    }
  };

  return (
    <div
      className="kan-field-header group mb-2 flex w-full cursor-pointer items-center justify-between gap-1 text-left text-sm font-semibold text-neutral-800 dark:text-dark-1000"
      onClick={onToggle}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="flex items-center gap-1">
        {onToggle && (
          collapsed ? (
            <HiChevronRight className="kan-field-header-chevron h-4 w-4 shrink-0 text-neutral-400" />
          ) : (
            <HiChevronDown className="kan-field-header-chevron h-4 w-4 shrink-0 text-neutral-400" />
          )
        )}
        {title}
      </div>
      {(onAdd || (isSection && onToggle && collapsed)) && canEdit && (
        <button
          type="button"
          onClick={handlePlusClick}
          className="kan-field-header-add rounded p-1 text-neutral-400 transition-all hover:bg-light-200 hover:text-neutral-700 dark:text-dark-700 dark:hover:bg-dark-300"
        >
          <HiPlus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
