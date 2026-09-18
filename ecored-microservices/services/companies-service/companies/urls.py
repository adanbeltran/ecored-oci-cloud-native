from django.urls import path

from .views import CompanyDetailView, CompanyListCreateView, HealthView

urlpatterns = [
    path("health", HealthView.as_view()),
    path("companies", CompanyListCreateView.as_view()),
    path("companies/<str:company_id>", CompanyDetailView.as_view()),
]
