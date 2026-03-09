import { Navigate } from 'react-router-dom'
import SupportChatWorkspace from '../../components/chat/SupportChatWorkspace'
import { useAuthStore } from '../../store/authStore'

const CandidateSupportChatPage = () => {
  const { user } = useAuthStore()
  if (user?.role !== 'candidato' && user?.role !== 'responsable') {
    return <Navigate to="/dashboard" replace />
  }

  return <SupportChatWorkspace mode="candidate" />
}

export default CandidateSupportChatPage
