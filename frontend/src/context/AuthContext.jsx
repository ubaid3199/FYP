import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios'; // We'll keep this since your initAuth uses it

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on app load
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Verify token with backend and get user profile
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

 const login = async (email, password) => {
    try {
      // Send the request via the shared API client (baseURL is configured in ../api/axios)
      const response = await api.post('/auth/login', { email, password });

      // 2. CRITICAL: Extract the token and user from the backend response
      const { token, user: userData } = response.data;

      // 3. Save the token to the browser so you stay logged in
      localStorage.setItem('token', token);

      // 4. Update the React state to unlock the ProtectedRoutes
      setUser(userData);

      return userData;
    } catch (error) {
      console.error("Frontend Auth Error:", error);
      throw error;
    }
  };

const logout = async () => {
    try {
      // Your existing logout API calls...
      
      // Add these two lines to clear the chat history!
      localStorage.removeItem('unibot_chats');
      localStorage.removeItem('unibot_active_tab');
      
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);