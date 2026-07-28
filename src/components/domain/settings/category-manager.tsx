import { asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import {
  ChevronLeft,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ReorderableList } from '@/components/ui/reorderable-list';
import { DEFAULT_NEW_ICON, EMOJI_GROUPS } from '@/constants/emojis';
import { db } from '@/db';
import { categories, type Category } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayLabel, useI18n, type TFunction } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { newId } from '@/lib/utils';

const ROW_HEIGHT = 56;
/** 공백 포함. 빠른 기록 그리드가 4열이라 이보다 길면 칸을 넘긴다. */
const NAME_MAX = 10;

/** 편집 중인 값. id가 null이면 새로 만드는 중이다. */
type Draft = {
  id: string | null;
  key: string | null;
  name: string;
  defaultName: string | null;
  icon: string;
};

const draftOf = (category: Category, t: TFunction): Draft => {
  const defaultName = category.name == null ? categoryDisplayLabel(category, t) : null;
  return {
    id: category.id,
    key: category.key,
    name: category.name ?? defaultName ?? '',
    defaultName,
    icon: category.icon,
  };
};

const newDraft = (): Draft => ({
  id: null,
  key: null,
  name: '',
  defaultName: null,
  icon: DEFAULT_NEW_ICON,
});

/**
 * 카테고리 관리 패널 — 시트가 아니라 "내용"이다.
 * 설정 탭(시트로 감싸서)과 빠른 기록(키패드 자리를 그대로 넘겨받아서) 두 곳에서 쓴다.
 *
 * 목록 → 수정 두 단계뿐이다. onBack은 목록에서 한 번 더 뒤로 갈 때 호출된다.
 */
export function CategoryManager({ onBack }: { onBack: () => void }) {
  const { scheme } = useTheme();
  const { t } = useI18n();

  // 삭제한 것(hiddenAt)은 목록에서 사라진다 — 과거 지출은 이 행을 그대로 참조한다
  const query = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.hiddenAt))
      .orderBy(asc(categories.sortOrder)),
  );

  /** 드래그 중에는 배열이 진실의 원천이므로 로컬에 들고 있는다 */
  const [order, setOrder] = useState<Category[]>([]);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<Category | null>(null);

  const rows = query.data;
  useEffect(() => {
    if (!rows || dragging) return;
    // '기타'는 분류되지 않은 지출의 표시용 행이라 유저가 만지는 목록에는 넣지 않는다
    setOrder(rows.filter((c) => c.key !== 'other'));
  }, [rows, dragging]);

  const move = async (from: number, to: number) => {
    if (from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setOrder(next);

    const now = Date.now();
    for (const [index, category] of next.entries()) {
      if (category.sortOrder === index) continue;
      await db
        .update(categories)
        .set({ sortOrder: index, updatedAt: now })
        .where(eq(categories.id, category.id));
    }
  };

  /**
   * 삭제 — 행을 지우지 않고 hiddenAt만 찍는다.
   * 이미 기록된 지출이 이 id를 참조하고 있어서 물리 삭제하면 과거 기록의 이름/아이콘이 깨진다.
   */
  const remove = async (category: Category) => {
    setConfirm(null);
    const now = Date.now();
    await db
      .update(categories)
      .set({ hiddenAt: now, updatedAt: now })
      .where(eq(categories.id, category.id));
    haptics.notification();
  };

  const submit = async () => {
    if (!draft) return;
    const rawLabel = draft.name.trim();
    const label = draft.defaultName && rawLabel === draft.defaultName ? '' : rawLabel;
    const now = Date.now();

    if (!draft.id) {
      if (!label) return;
      await db.insert(categories).values({
        id: newId(),
        key: null,
        name: label,
        icon: draft.icon,
        sortOrder: order.length,
        isCustom: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // 기본 카테고리에서 이름을 비우면 다시 앱이 번역하는 기본 이름으로 돌아간다
      await db
        .update(categories)
        .set({ name: label || null, icon: draft.icon, updatedAt: now })
        .where(eq(categories.id, draft.id));
    }

    setDraft(null);
    haptics.notification();
  };

  if (draft) {
    const rawLabel = draft.name.trim();
    const label = draft.defaultName && rawLabel === draft.defaultName ? '' : rawLabel;
    const canSave = Boolean(label) || Boolean(draft.key);
    return (
      <View className="flex-1">
        <Header
          title={
            draft.id
              ? t('categoryManager.editTitle', '카테고리 수정')
              : t('categoryManager.newTitle', '새 카테고리')
          }
          onBack={() => setDraft(null)}
        />

        <View className="mb-4 flex-row items-center gap-3">
          <View
            style={{ backgroundColor: scheme.primarySoft }}
            className="h-14 w-14 items-center justify-center rounded-2xl"
          >
            <Text className="text-3xl">{draft.icon}</Text>
          </View>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((d) => (d ? { ...d, name } : d))}
            placeholder={t('categoryManager.namePlaceholder', '이름 (예: 마사지)')}
            placeholderTextColor={scheme.mutedForeground}
            accessibilityLabel={t('categoryManager.nameA11y', '카테고리 이름')}
            // 그리드 한 칸(4열)에 한 줄로 들어가야 해서 길이를 막는다
            maxLength={NAME_MAX}
            autoFocus={!draft.id}
            returnKeyType="done"
            style={{ backgroundColor: scheme.muted, fontSize: 16, fontWeight: '500' }}
            className="h-14 flex-1 rounded-2xl px-4 text-base font-bold text-neutral-900 dark:text-neutral-50"
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {EMOJI_GROUPS.map((group) => (
            <View key={group.label} className="mb-3 gap-1.5">
              <Text className="pl-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">
                {group.label}
              </Text>
              <View className="flex-row flex-wrap">
                {group.emojis.map((emoji) => {
                  const selected = draft.icon === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={emoji}
                      onPress={() => {
                        haptics.selection();
                        setDraft((d) => (d ? { ...d, icon: emoji } : d));
                      }}
                      // active:는 Pressable 자신에 둔다 (자식 View에 두면 터치를 가로챈다)
                      className="p-1 active:opacity-70"
                      style={{ width: '12.5%' }}
                    >
                      <View
                        style={{
                          backgroundColor: selected ? scheme.primarySoft : scheme.muted,
                          borderColor: selected ? scheme.primary : 'transparent',
                        }}
                        className="items-center justify-center rounded-xl border-2 py-2"
                      >
                        <Text className="text-xl">{emoji}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View className="pt-2">
          <Button
            label={draft.id ? t('common.save', '저장') : t('categoryManager.create', '만들기')}
            disabled={!canSave}
            onPress={() => void submit()}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Header title={t('settings.categories', '카테고리 관리')} onBack={onBack} />
      <Text className="-mt-2 mb-3 text-sm font-semibold text-neutral-400">
        {t(
          'categoryManager.description',
          '길게 눌러 순서를 바꾸고, 왼쪽으로 밀면 수정·삭제가 나와요',
        )}
      </Text>

      <ScrollView
        scrollEnabled={!dragging}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        <ReorderableCategories
          order={order}
          onMove={(from, to) => void move(from, to)}
          onDragChange={setDragging}
          onEdit={(item) => setDraft(draftOf(item, t))}
          onDelete={setConfirm}
        />
      </ScrollView>

      {/* 목록이 길어져도 만들기는 늘 같은 자리에 있어야 한다 */}
      <View className="pt-2">
        <Button
          label={t('categoryManager.createNew', '새 카테고리 만들기')}
          icon={<Plus size={18} color={scheme.primaryForeground} />}
          onPress={() => {
            haptics.selection();
            setDraft(newDraft());
          }}
        />
      </View>

      <ConfirmDialog
        visible={confirm !== null}
        title={
          confirm
            ? t('categoryManager.deleteTitle', "'{{name}}'을 삭제할까요?", {
                name: categoryDisplayLabel(confirm, t),
              })
            : ''
        }
        message={t(
          'categoryManager.deleteMessage',
          '이미 기록한 지출은 그대로 남고, 앞으로 고를 수 없게 돼요.',
        )}
        actions={[
          {
            label: t('common.delete', '삭제'),
            variant: 'destructive',
            onPress: () => confirm && void remove(confirm),
          },
          { label: t('common.keepIt', '그대로 둘게요'), variant: 'ghost' },
        ]}
        onDismiss={() => setConfirm(null)}
      />
    </View>
  );
}

/**
 * ReorderableList는 items가 비어 있으면 높이 0짜리 빈 뷰를 그린다.
 * 시드 직후 한 프레임 동안 그 상태가 될 수 있어 분리해 두었을 뿐, 로직은 없다.
 */
function ReorderableCategories({
  order,
  onMove,
  onDragChange,
  onEdit,
  onDelete,
}: {
  order: Category[];
  onMove: (from: number, to: number) => void;
  onDragChange: (dragging: boolean) => void;
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();

  return (
    <ReorderableList
      items={order}
      keyExtractor={(item) => item.id}
      rowHeight={ROW_HEIGHT}
      onMove={onMove}
      onDragChange={onDragChange}
      bleed={0}
      renderRightActions={(item) => (
        <View className="flex-row items-center">
          {/*
            close()를 부르지 않는다 — 닫힘 스프링이 도는 동안 이 행이 사라지면
            worklets가 이미 풀려난 콜백을 불러 앱이 죽는다 (reanimated #9776).
          */}
          <Action
            label={t('common.edit', '수정')}
            color={scheme.primary}
            foreground={scheme.primaryForeground}
            Icon={Pencil}
            onPress={() => onEdit(item)}
          />
          <Action
            label={t('common.delete', '삭제')}
            color={scheme.destructive}
            foreground={scheme.destructiveForeground}
            Icon={Trash2}
            onPress={() => onDelete(item)}
          />
        </View>
      )}
      renderRow={(item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categoryManager.editA11y', '{{name}} 수정', {
            name: categoryDisplayLabel(item, t),
          })}
          onPress={() => {
            haptics.selection();
            onEdit(item);
          }}
          // 스와이프로 밀었을 때 아래 액션이 비치지 않게 배경을 깐다
          style={{ height: ROW_HEIGHT, backgroundColor: scheme.card }}
          className="flex-row items-center gap-3 px-1 active:opacity-60"
        >
          <GripVertical size={16} color={scheme.mutedForeground} />
          <Text className="text-xl">{item.icon}</Text>
          <Text className="flex-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
            {categoryDisplayLabel(item, t)}
          </Text>
        </Pressable>
      )}
    />
  );
}

/** 아이콘과 라벨이 같은 foreground를 쓰도록 색을 한 곳에서만 받는다. */
function Action({
  label,
  color,
  foreground,
  Icon,
  onPress,
}: {
  label: string;
  color: string;
  foreground: string;
  Icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ backgroundColor: color, height: ROW_HEIGHT - 8 }}
      className="w-20 items-center justify-center gap-0.5 active:opacity-70"
    >
      <Icon size={16} color={foreground} />
      <Text style={{ color: foreground }} className="text-xs font-bold">
        {label}
      </Text>
    </Pressable>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('main.backA11y', '뒤로')}
        hitSlop={10}
        onPress={() => {
          haptics.selection();
          onBack();
        }}
        className="-ml-2 p-2 active:opacity-60"
      >
        <ChevronLeft size={22} color={scheme.foreground} />
      </Pressable>
      <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">{title}</Text>
    </View>
  );
}
