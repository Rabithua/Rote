// 使用context加reducer作为全局状态管理系统

import { getUserProfile } from "@/api/user/main";
import { Profile, ProfileAction } from "@/types/main";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
} from "react";

const ProfileContext = createContext<Profile | null>(null);
const ProfileDispatchContext =
  createContext<React.Dispatch<ProfileAction> | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, dispatch] = useReducer(
    profileReducer,
    localStorage.getItem("profile")
      ? JSON.parse(localStorage.getItem("profile") as string)
      : undefined
  );

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await getUserProfile();
        // save in local storage
        localStorage.setItem("profile", JSON.stringify(res.data.data));
        dispatch({ type: "updateProfile", profile: res.data.data });
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        localStorage.removeItem("profile");
        dispatch({ type: "updateProfile", profile: undefined });
      }
    }

    fetchProfile();
  }, []);

  return (
    <ProfileContext.Provider value={profile}>
      <ProfileDispatchContext.Provider value={dispatch}>
        {children}
      </ProfileDispatchContext.Provider>
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

export function useProfileDispatch() {
  const context = useContext(ProfileDispatchContext);
  if (context === null) {
    throw new Error("ProfileDispatch must be used within a ProfileProvider");
  }
  return context;
}

function profileReducer(profile: Profile, action: ProfileAction): Profile {
  switch (action.type) {
    case "updateProfile": {
      return action.profile;
    }
    default: {
      throw new Error("Unknown action: " + action);
    }
  }
}
