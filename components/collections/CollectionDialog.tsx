"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/components/Dialog";
import { Button, Field, FormAlert } from "@/components/ui";
import { createCollection, updateCollection, type Collection } from "@/lib/collections";
import { addRefsToCollection } from "@/lib/refs";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  // 고치기면 기존 컬렉션, 새로 만들기면 비움
  editing?: Collection | null;
  // 새로 만들면서 바로 넣을 레퍼런스들
  refIds?: string[];
  onSaved: (c: Collection) => void;
};

export function CollectionDialog({ open, onClose, editing, refIds = [], onSaved }: Props) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setError(null);
    setSaving(false);
  }, [open, editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("컬렉션 이름을 입력해 주세요."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = editing
        ? await updateCollection(editing.id, { name, description })
        : await createCollection(name, description);
      if (!editing && refIds.length) await addRefsToCollection(saved.id, refIds);
      onSaved(saved);
      onClose();
    } catch {
      setError(t("저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? t("컬렉션 고치기") : t("새 컬렉션")}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field
          label={t("이름")}
          name="collection-name"
          placeholder={t("예: 2026 리브랜딩, 포트폴리오 사이트")}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="collection-desc" className="text-sm font-medium">
            {t("설명")} <span className="font-normal text-graphite">{t("(선택)")}</span>
          </label>
          <textarea
            id="collection-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("어떤 프로젝트를 위한 묶음인지 적어 두세요.")}
            className="resize-none rounded-lg border border-hairline px-3.5 py-3 text-[15px] outline-none placeholder:text-graphite focus:border-ink"
          />
        </div>
        {!editing && refIds.length > 0 && (
          <p className="text-[13px] text-graphite">{t("선택한 레퍼런스 {n}개가 바로 들어가요.", { n: refIds.length })}</p>
        )}
        <FormAlert message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("취소")}
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? t("저장") : t("만들기")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
