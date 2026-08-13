import { Navigate } from 'react-router-dom';

export default function OfficialResourcesPreview() {
  return <Navigate to="/profile/setting?officialResourcesPreview=pro" replace />;
}
