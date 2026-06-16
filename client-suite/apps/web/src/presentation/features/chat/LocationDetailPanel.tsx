/**
 * LocationDetailPanel — 位置分享详情面板 (stitch_2 对齐)
 * 地图占位区 + POI 信息卡(名称/地址/评分/距离) + 路线/发送到聊天按钮
 */
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface LocationDetailPanelProps {
  onClose?: () => void;
}

export function LocationDetailPanel({ onClose }: LocationDetailPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#e8e4d8]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-bg-white-var border-b border-border">
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded-md text-text-secondary hover:bg-bg-hover">
            <Icon name="close" size={20} />
          </button>
        )}
        <h3 className="text-sm font-semibold text-text-primary">位置详情</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => useToastStore.getState().addToast('分享功能开发中', 'info')} className="p-1.5 text-text-secondary hover:bg-bg-hover rounded-md">
            <Icon name="ios_share" size={18} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('更多操作开发中', 'info')} className="p-1.5 text-text-secondary hover:bg-bg-hover rounded-md">
            <Icon name="more_horiz" size={18} />
          </button>
        </div>
      </div>

      {/* Map area placeholder */}
      <div className="flex-1 relative">
        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
          <button type="button" onClick={() => useToastStore.getState().addToast('已放大', 'info')} className="w-8 h-8 bg-bg-white-var rounded-lg shadow-md flex items-center justify-center text-text-secondary hover:text-primary">
            <Icon name="add" size={18} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('已缩小', 'info')} className="w-8 h-8 bg-bg-white-var rounded-lg shadow-md flex items-center justify-center text-text-secondary hover:text-primary">
            <Icon name="remove" size={18} />
          </button>
        </div>
        <button type="button" onClick={() => useToastStore.getState().addToast('正在定位…', 'info')} className="absolute top-16 right-4 w-8 h-8 bg-bg-white-var rounded-lg shadow-md flex items-center justify-center text-text-secondary hover:text-primary z-10">
          <Icon name="my_location" size={18} />
        </button>

        {/* Map placeholder with pin */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="px-3 py-1 rounded-full bg-primary text-white text-xs font-medium mb-1">
              上海静安嘉里中心
            </span>
            <div className="w-8 h-8 rounded-full bg-primary border-4 border-white shadow-lg flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-bg-white-var" />
            </div>
          </div>
        </div>
      </div>

      {/* POI card */}
      <div className="bg-bg-white-var rounded-t-3xl shadow-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">上海静安嘉里中心</h3>
            <p className="text-xs text-text-muted mt-1">上海市静安区南京西路1515号</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs">
                <Icon name="star" size={14} className="text-warning" />
                <span className="font-medium text-text-primary">4.8</span>
                <span className="text-text-muted">(2,410)</span>
              </span>
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <Icon name="navigation" size={12} />
                距离 1.2 km
              </span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-xl bg-fill-tertiary flex items-center justify-center shrink-0">
            <Icon name="location_city" size={28} className="text-text-muted" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('路线规划功能开发中', 'info')}
            className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="directions" size={16} />
            路线
          </button>
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('已发送位置到聊天', 'success')}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="send" size={16} />
            发送到聊天
          </button>
        </div>
      </div>
    </div>
  );
}
