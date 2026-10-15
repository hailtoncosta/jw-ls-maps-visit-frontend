import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, getToken } from '@/api/apiClient';
const AuthContext = createContext();
const USER_CACHE_KEY = 'ls_offline_user_cache';
const readCachedUser = () => { try { const v=localStorage.getItem(USER_CACHE_KEY); return v?JSON.parse(v):null; } catch { return null; } };
const writeCachedUser = (u) => { try { if(u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u)); } catch {} };
const clearCachedUser = () => { try { localStorage.removeItem(USER_CACHE_KEY); } catch {} };
export const AuthProvider = ({ children }) => {
 const [user,setUser]=useState(null),[isAuthenticated,setIsAuthenticated]=useState(false),[isLoadingAuth,setIsLoadingAuth]=useState(true),[authError,setAuthError]=useState(null);
 const checkAppState=async()=>{ setIsLoadingAuth(true); setAuthError(null); if(!getToken()){setIsAuthenticated(false);setIsLoadingAuth(false);return;} try{const u=await api.auth.me(); if(u?.active===false&&u?.role!=='admin'){throw new Error('Conta desativada');} setUser(u);setIsAuthenticated(true);writeCachedUser(u);}catch(e){setUser(null);setIsAuthenticated(false);clearCachedUser();setAuthError({type:'auth_required',message:e.message});}finally{setIsLoadingAuth(false);} };
 useEffect(()=>{
   checkAppState();
   const expired=()=>{setUser(null);setIsAuthenticated(false);clearCachedUser();setAuthError({type:'auth_required',message:'Sessão expirada'});};
   const refresh=()=>{if(getToken()) api.auth.me().then(u=>{setUser(u);writeCachedUser(u);}).catch(()=>{});};
   const visible=()=>{if(document.visibilityState==='visible')refresh();};
   window.addEventListener('ls-auth-expired',expired);
   window.addEventListener('focus',refresh);
   document.addEventListener('visibilitychange',visible);
   return()=>{window.removeEventListener('ls-auth-expired',expired);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const logout=()=>{setUser(null);setIsAuthenticated(false);clearCachedUser();api.auth.logout();};
 const navigateToLogin=()=>api.auth.redirectToLogin();
 return <AuthContext.Provider value={{user,isAuthenticated,isLoadingAuth,isLoadingPublicSettings:false,authError,appPublicSettings:null,logout,navigateToLogin,checkAppState}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>useContext(AuthContext);
