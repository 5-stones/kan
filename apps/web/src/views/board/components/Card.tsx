import { format, isBefore, startOfDay } from "date-fns";
import { HiOutlinePaperClip } from "react-icons/hi";
import { HiOutlineClock } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import Avatar from "~/components/Avatar";
import Badge from "~/components/Badge";
import CircularProgress from "~/components/CircularProgress";
import LabelIcon from "~/components/LabelIcon";
import { useLocalisation } from "~/hooks/useLocalisation";
import { getAvatarUrl } from "~/utils/helpers";

const Card = ({
  title,
  starred,
  ticketNumber,
  labels,
  members,
  checklists,
  attachments,
  dueDate,
  showOnBoardFields,
}: {
  title: string;
  starred?: boolean; // coraggio
  ticketNumber?: string | null;
  labels: { name: string; colourCode: string | null }[];
  members: {
    publicId: string;
    email: string;
    user: { name: string | null; email: string; image: string | null } | null;
  }[];
  checklists: {
    publicId: string;
    name: string;
    items: {
      publicId: string;
      title: string;
      completed: boolean;
      index: number;
    }[];
  }[];
  description: string | null;
  comments: { publicId: string }[];
  attachments?: { publicId: string }[];
  dueDate?: Date | null;
  showOnBoardFields?: Array<{ sectionKey: string; fieldKey: string; title: string; value: string }>;
}) => {
  const { dateLocale } = useLocalisation();
  const isOverdue = dueDate ? isBefore(dueDate, startOfDay(new Date())) : false;
  const completedItems = checklists.reduce((acc, checklist) => {
    return acc + checklist.items.filter((item) => item.completed).length;
  }, 0);

  const totalItems = checklists.reduce((acc, checklist) => {
    return acc + checklist.items.length;
  }, 0);

  const progress =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const hasAttachments = attachments && attachments.length > 0;
  const hasDueDate = !!dueDate;

  return (
    <div className={`card${starred ? " card-starred" : ""} flex flex-col overflow-hidden rounded-md border border-border bg-card px-3 py-2 text-sm text-text hover:bg-light-200 dark:border-borderDark dark:bg-cardDark dark:text-textDark dark:hover:bg-dark-300`}>
      {ticketNumber && (
        <span className="mb-1 text-xs text-textMuted dark:text-textMutedDark">
          {ticketNumber}
        </span>
      )}
      <span className="break-words">{title}</span>
      {showOnBoardFields && showOnBoardFields.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5">
          {showOnBoardFields.map(({ sectionKey, fieldKey, title: fieldTitle, value }) => (
            <span
              key={`${sectionKey}.${fieldKey}`}
              className={`kan-custom-field kan-field-${fieldKey} text-[11px] text-light-800 dark:text-dark-800`}
              data-field-key={fieldKey}
            >
              <span className="font-medium">{fieldTitle}:</span> {value}
            </span>
          ))}
        </div>
      )}
      {labels.length ||
      members.length ||
      checklists.length > 0 ||
      hasDueDate ||
      hasAttachments ? (
        <div className="mt-2 flex flex-col justify-end">
          <div className="space-x-0.5">
            {labels.map((label) => (
              <Badge
                value={label.name}
                iconLeft={<LabelIcon colourCode={label.colourCode} />}
                colourCode={label.colourCode} // coraggio
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              {/* coraggio: no notes (description) or comment indicators */}
              {hasDueDate && dueDate && (
                <div
                  className={twMerge(
                    "card-due flex items-center gap-1",
                    isOverdue && "card-due-overdue", // coraggio
                    isOverdue
                      ? "text-red-600 dark:text-red-400"
                      : "text-textMuted dark:text-textMutedDark",
                  )}
                >
                  <HiOutlineClock className="h-4 w-4" />
                  <span className="text-[11px]">
                    {/* coraggio: always "Aug 17, 2026" */}
                    {format(dueDate, "MMM d, yyyy", { locale: dateLocale })}
                  </span>
                </div>
              )}
              {hasAttachments && (
                <div className="flex items-center gap-1 text-textMuted dark:text-textMutedDark">
                  <HiOutlinePaperClip className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-1">
              {checklists.length > 0 && (
                <div className="flex items-center gap-1 rounded-full border-[1px] border-light-300 px-2 py-1 dark:border-dark-600">
                  <CircularProgress
                    progress={progress || 2}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <span className="text-[10px] text-light-900 dark:text-dark-950">
                    {completedItems}/{totalItems}
                  </span>
                </div>
              )}
              {members.length > 0 && (
                <div className="isolate flex justify-end -space-x-1 overflow-hidden">
                  {members.map(({ user, email }) => {
                    const avatarUrl = user?.image
                      ? getAvatarUrl(user.image)
                      : undefined;

                    return (
                      <Avatar
                        name={user?.name ?? ""}
                        email={user?.email ?? email}
                        imageUrl={avatarUrl}
                        size="sm"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Card;
