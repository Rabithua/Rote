import { useProfile } from "@/state/profile";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: any) => {
    const profile = useProfile();
    if (!profile) {
        return <Navigate to="/login" />;
    }
    return children;
};