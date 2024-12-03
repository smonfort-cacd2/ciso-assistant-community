from django.urls import include, path
from rest_framework import routers

from ebios_rm.views import EbiosRMStudyViewSet

router = routers.DefaultRouter()

router.register(r"ebios-rm-studies", EbiosRMStudyViewSet, basename="ebios-rm-studies")

urlpatterns = [
    path("", include(router.urls)),
]
