import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Draggable } from "react-beautiful-dnd";
import { useForm } from "react-hook-form";
import { HiEllipsisHorizontal, HiOutlineTrash } from "react-icons/hi2";

import { authClient } from "@kan/auth/client";

import Dropdown from "~/components/Dropdown";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { api } from "~/utils/api";

interface ListProps {
  children: ReactNode;
  index: number;
  list: List;
  setSelectedPublicListId: (publicListId: PublicListId) => void;
}

interface List {
  publicId: string;
  name: string;
  createdBy?: string | null;
}

interface FormValues {
  listPublicId: string;
  name: string;
}

type PublicListId = string;

export default function List({
  children,
  index,
  list,
  setSelectedPublicListId,
}: ListProps) {
  const { openModal } = useModal();
  const { canEditList, canDeleteList } = usePermissions();
  const { data: session } = authClient.useSession();
  const isCreator = list.createdBy && session?.user.id === list.createdBy;
  const canEdit = canEditList || isCreator;
  const canDrag = canEditList || isCreator;

  const updateList = api.list.update.useMutation();

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      listPublicId: list.publicId,
      name: list.name,
    },
    values: {
      listPublicId: list.publicId,
      name: list.name,
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!canEdit) return;
    updateList.mutate({
      listPublicId: values.listPublicId,
      name: values.name,
    });
  };

  const handleOpenDeleteListConfirmation = () => {
    setSelectedPublicListId(list.publicId);
    openModal("DELETE_LIST");
  };

  return (
    <Draggable
      key={list.publicId}
      draggableId={list.publicId}
      index={index}
      isDragDisabled={!canDrag}
    >
      {(provided) => (
        <div
          key={list.publicId}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="board-list mr-5 h-fit min-w-[18rem] max-w-[18rem] snap-start rounded-md border border-border bg-surface py-2 pl-2 pr-1 text-text dark:border-borderDark dark:bg-surfaceDark dark:text-textDark md:snap-align-none"
        >
          <div className="board-list-header mb-2 flex justify-between">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="w-full focus-visible:outline-none"
            >
              <input
                id="name"
                type="text"
                {...register("name")}
                onBlur={handleSubmit(onSubmit)}
                readOnly={!canEdit}
                className="w-full border-0 bg-transparent px-4 pt-1 text-sm font-medium text-text focus:ring-0 focus-visible:outline-none dark:text-textDark"
              />
            </form>
            <div className="flex items-center">
              {/* coraggio: cards are added from the board header's "+" button,
                  so lists have no add-card button or menu item */}
              {(() => {
                const dropdownItems = [
                  ...(canDeleteList || isCreator
                    ? [
                        {
                          label: t`Delete list`,
                          action: handleOpenDeleteListConfirmation,
                          icon: (
                            <HiOutlineTrash className="h-[18px] w-[18px] text-dark-900" />
                          ),
                        },
                      ]
                    : []),
                ];

                if (dropdownItems.length === 0) {
                  return null;
                }

                return (
                  <div className="relative mr-1 inline-block">
                    <Dropdown items={dropdownItems}>
                      <HiEllipsisHorizontal className="h-5 w-5 text-dark-900" />
                    </Dropdown>
                  </div>
                );
              })()}
            </div>
          </div>
          {children}
        </div>
      )}
    </Draggable>
  );
}
