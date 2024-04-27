// 使用context加reducer作为全局状态管理系统

import { getUserProfile } from "@/api/login/main";
import { Profile, ProfileAction } from "@/types/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const ProfileContext = createContext<Profile | null>(null);
const ProfileDispatchContext =
  createContext<React.Dispatch<ProfileAction> | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, dispatch] = useReducer(profileReducer, initialProfile);

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

const initialProfile = undefined;
