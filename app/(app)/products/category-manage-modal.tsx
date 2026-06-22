"use client";

import * as React from "react";
import { Tags, Plus, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/app/(app)/chat/actions";
import type { CategoryView } from "@/src/lib/products/category";

type CategoryManageModalProps = Readonly<{
  isOpen: boolean;
  categories: CategoryView[];
  onClose: () => void;
  onChanged: () => void;
}>;

export function CategoryManageModal({
  isOpen,
  categories,
  onClose,
  onChanged,
}: CategoryManageModalProps) {
  const [items, setItems] = React.useState<CategoryView[]>(categories);
  const [newName, setNewName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setItems(categories);
  }, [categories]);

  React.useEffect(() => {
    if (isOpen) {
      setNewName("");
      setCreateError(null);
      setIsCreating(false);
      setEditingId(null);
      setEditName("");
      setConfirmingId(null);
      setRowError({});
      setBusyId(null);
    }
  }, [isOpen]);

  const isBusy = isCreating || busyId !== null;

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) {
    return null;
  }

  function setErrorFor(id: string, message: string) {
    setRowError((current) => ({ ...current, [id]: message }));
  }

  function clearErrorFor(id: string) {
    setRowError((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const result = await createCategory(newName);
      if (!result.ok) {
        setCreateError(result.message);
        return;
      }
      setItems((current) =>
        [...current, result.data].sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      setNewName("");
      onChanged();
    } catch (error) {
      console.error("createCategory failed", error);
      setCreateError("Chưa thêm được danh mục, bác thử lại ạ.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleStartEdit(category: CategoryView) {
    setEditingId(category.id);
    setEditName(category.name);
    clearErrorFor(category.id);
  }

  async function handleRename(id: string) {
    setBusyId(id);
    clearErrorFor(id);
    try {
      const result = await renameCategory(id, editName);
      if (!result.ok) {
        setErrorFor(id, result.message);
        return;
      }
      setItems((current) =>
        current
          .map((item) => (item.id === id ? result.data : item))
          .sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      setEditingId(null);
      setEditName("");
      onChanged();
    } catch (error) {
      console.error("renameCategory failed", error);
      setErrorFor(id, "Chưa sửa được danh mục, bác thử lại ạ.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    clearErrorFor(id);
    try {
      const result = await deleteCategory(id);
      if (!result.ok) {
        setErrorFor(id, result.message);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmingId(null);
      onChanged();
    } catch (error) {
      console.error("deleteCategory failed", error);
      setErrorFor(id, "Chưa xóa được danh mục, bác thử lại ạ.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-paperDeep/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={isBusy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manage-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 p-4 outline-none"
      >
        <div className="rounded-lg border border-ledgerBorder bg-surface p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paperNote text-inkDeep">
                <Tags className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2
                id="category-manage-title"
                className="text-[17px] font-semibold text-inkDeep"
              >
                Quản lý danh mục
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              aria-label="Đóng"
              className="h-9 w-9 rounded border-ledgerBorder bg-surface p-0 text-textMute hover:bg-paperWarm hover:text-ink disabled:opacity-55"
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <form onSubmit={handleCreate} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                disabled={isCreating}
                placeholder="Tên danh mục mới"
                className="h-11 w-full rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:opacity-60 sm:h-10"
                onChange={(event) => setNewName(event.target.value)}
              />
              <Button
                type="submit"
                disabled={isCreating || newName.trim().length === 0}
                className="h-11 shrink-0 rounded bg-ink px-3 font-semibold text-paper hover:bg-inkDeep disabled:opacity-55 sm:h-10"
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                {isCreating ? "Đang thêm..." : "Thêm"}
              </Button>
            </div>
            {createError ? (
              <p className="mt-2 text-[14px] leading-5 text-debt" role="alert">
                {createError}
              </p>
            ) : null}
          </form>

          <div className="max-h-[50vh] overflow-y-auto rounded border border-ledgerBorder">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-textMute">
                Chưa có danh mục nào.
              </p>
            ) : (
              <ul className="divide-y divide-ledgerBorder">
                {items.map((category) => {
                  const isEditing = editingId === category.id;
                  const isConfirming = confirmingId === category.id;
                  const rowBusy = busyId === category.id;
                  const error = rowError[category.id] ?? null;

                  return (
                    <li key={category.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            disabled={rowBusy}
                            className="h-10 w-full rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none focus:border-ink disabled:opacity-60"
                            onChange={(event) => setEditName(event.target.value)}
                          />
                        ) : (
                          <span className="flex-1 truncate font-semibold text-inkDeep">
                            {category.name}
                          </span>
                        )}

                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              disabled={rowBusy || editName.trim().length === 0}
                              aria-label={`Lưu ${category.name}`}
                              className="h-9 shrink-0 rounded bg-ink px-3 font-semibold text-paper hover:bg-inkDeep disabled:opacity-55"
                              onClick={() => void handleRename(category.id)}
                            >
                              <Save className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={rowBusy}
                              aria-label={`Hủy sửa ${category.name}`}
                              className="h-9 shrink-0 rounded border-ledgerBorder bg-surface px-3 text-textMute hover:bg-paperWarm hover:text-ink disabled:opacity-55"
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                              }}
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </>
                        ) : isConfirming ? (
                          <>
                            <Button
                              type="button"
                              disabled={rowBusy}
                              className="h-9 shrink-0 rounded bg-debt px-3 font-semibold text-white hover:bg-debt/90 disabled:opacity-55"
                              onClick={() => void handleDelete(category.id)}
                            >
                              {rowBusy ? "Đang xóa..." : "Xóa thật"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={rowBusy}
                              className="h-9 shrink-0 rounded border-ledgerBorder bg-surface px-3 text-textMute hover:bg-paperWarm hover:text-ink disabled:opacity-55"
                              onClick={() => setConfirmingId(null)}
                            >
                              Thôi
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isBusy}
                              aria-label={`Sửa ${category.name}`}
                              className="h-9 w-9 shrink-0 rounded border-ledgerBorder bg-surface p-0 text-textMute hover:bg-paperWarm hover:text-ink disabled:opacity-55"
                              onClick={() => handleStartEdit(category)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isBusy}
                              aria-label={`Xóa ${category.name}`}
                              className="h-9 w-9 shrink-0 rounded border-ledgerBorder bg-surface p-0 text-textMute hover:bg-paperWarm hover:text-debt disabled:opacity-55"
                              onClick={() => {
                                clearErrorFor(category.id);
                                setConfirmingId(category.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                      {error ? (
                        <p className="mt-2 text-[14px] leading-5 text-debt" role="alert">
                          {error}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
