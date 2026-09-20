import ConfirmModal from "@/component/admin/ui/feedback/confirmModal";

interface LoginErrorModalProps {
  open: boolean;
  onClose: () => void;
}

const LoginErrorModal = ({ open, onClose }: LoginErrorModalProps) => {
  return (
    <ConfirmModal
      open={open}
      onCancel={onClose}
      onConfirm={onClose}
      hideCancel
      variant="danger"
      size="sm"
      title="로그인 실패"
      description="ID 또는 비밀번호가 일치하지 않습니다. 다시 확인해주세요."
      confirmLabel="다시 시도"
    />
  );
};

export default LoginErrorModal;