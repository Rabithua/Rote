import { getUserProfile } from "@/api/login/main";
import { apiGetMyTags } from "@/api/rote/main";
import { useProfile, useProfileDispatch } from "@/state/profile";
import { useTagsDispatch } from "@/state/tags";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: any) => {
  const profile = useProfile();
  const profileDispatch = useProfileDispatch();
  const tagsDispatch = useTagsDispatch();

  useEffect(() => {
    if (!profile) {
      initprofile();
    }
  }, []);

  async function initprofile() {
    let initialProfile = await getUserProfile()
      .then((res) => {
        return res.data.data;
      })
      .catch((err: any) => {
        return undefined;
      });

    if (initialProfile) {
      profileDispatch({
        type: "updateProfile",
        profile: initialProfile,
      });
      initTags();
    } else {
      return <Navigate to="/login" />;
    }
  }

  async function initTags() {
    const initialTags = await apiGetMyTags()
      .then((res) => {
        return res.data.data.map((item: any) => {
          return {
            value: item,
            label: item,
          };
        });
      })
      .catch((err: any) => {
        return [];
      });

    tagsDispatch({
      type: "freshAll",
      tags: initialTags,
    });
  }

  return children;
};
